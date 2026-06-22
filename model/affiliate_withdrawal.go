package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

const (
	AffiliateWithdrawalStatusPending   = "pending"
	AffiliateWithdrawalStatusApproved  = "approved"
	AffiliateWithdrawalStatusRejected  = "rejected"
	AffiliateWithdrawalStatusCancelled = "cancelled"
)

var (
	ErrAffiliateWithdrawalNotFound       = errors.New("提现申请不存在")
	ErrAffiliateWithdrawalStatusInvalid  = errors.New("提现申请状态不可操作")
	ErrAffiliateWithdrawalQuotaInvalid   = errors.New("提现额度无效")
	ErrAffiliateWithdrawalQuotaNotEnough = errors.New("邀请额度不足")
)

type AffiliateWithdrawal struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id" gorm:"index"`
	AlipayName    string `json:"alipay_name" gorm:"type:varchar(64)"`
	AlipayAccount string `json:"alipay_account" gorm:"type:varchar(128)"`
	Quota         int    `json:"quota" gorm:"default:0"`
	Status        string `json:"status" gorm:"type:varchar(20);index"`
	RejectReason  string `json:"reject_reason" gorm:"type:varchar(255);default:''"`
	ReviewerId    int    `json:"reviewer_id" gorm:"default:0;index"`
	ReviewedAt    int64  `json:"reviewed_at" gorm:"default:0"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func validateAffiliateWithdrawalInput(alipayName string, alipayAccount string, quota int) (string, string, error) {
	name := strings.TrimSpace(alipayName)
	account := strings.TrimSpace(alipayAccount)
	if name == "" || account == "" {
		return "", "", errors.New("支付宝收款姓名和账号不能为空")
	}
	if len([]rune(name)) > 64 {
		return "", "", errors.New("支付宝收款姓名过长")
	}
	if len([]rune(account)) > 128 {
		return "", "", errors.New("支付宝账号过长")
	}
	minQuota := int(common.QuotaPerUnit)
	if minQuota <= 0 {
		minQuota = 1
	}
	if quota < minQuota {
		return "", "", fmt.Errorf("提现额度最小为%s", logger.LogQuota(minQuota))
	}
	return name, account, nil
}

func CreateAffiliateWithdrawal(userId int, alipayName string, alipayAccount string, quota int) (*AffiliateWithdrawal, error) {
	name, account, err := validateAffiliateWithdrawalInput(alipayName, alipayAccount, quota)
	if err != nil {
		return nil, err
	}

	withdrawal := &AffiliateWithdrawal{
		UserId:        userId,
		AlipayName:    name,
		AlipayAccount: account,
		Quota:         quota,
		Status:        AffiliateWithdrawalStatusPending,
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&User{}).
			Where("id = ? AND aff_quota >= ?", userId, quota).
			Update("aff_quota", gorm.Expr("aff_quota - ?", quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAffiliateWithdrawalQuotaNotEnough
		}
		return tx.Create(withdrawal).Error
	})
	if err != nil {
		return nil, err
	}
	RecordLog(userId, LogTypeSystem, fmt.Sprintf("申请邀请奖励提现，暂扣 %s", logger.LogQuota(quota)))
	return withdrawal, nil
}

func CancelAffiliateWithdrawal(userId int, withdrawalId int) error {
	var quota int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var withdrawal AffiliateWithdrawal
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ? AND user_id = ?", withdrawalId, userId).
			First(&withdrawal).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAffiliateWithdrawalNotFound
			}
			return err
		}
		if withdrawal.Status != AffiliateWithdrawalStatusPending {
			return ErrAffiliateWithdrawalStatusInvalid
		}
		quota = withdrawal.Quota
		if err := tx.Model(&AffiliateWithdrawal{}).Where("id = ?", withdrawal.Id).Updates(map[string]interface{}{
			"status": AffiliateWithdrawalStatusCancelled,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", userId).Update("aff_quota", gorm.Expr("aff_quota + ?", withdrawal.Quota)).Error
	})
	if err != nil {
		return err
	}
	RecordLog(userId, LogTypeSystem, fmt.Sprintf("撤回邀请奖励提现申请，返还 %s", logger.LogQuota(quota)))
	return nil
}

func ReviewAffiliateWithdrawal(withdrawalId int, reviewerId int, approve bool, rejectReason string) error {
	var userId int
	var quota int
	status := AffiliateWithdrawalStatusApproved
	if !approve {
		status = AffiliateWithdrawalStatusRejected
	}
	reason := strings.TrimSpace(rejectReason)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var withdrawal AffiliateWithdrawal
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", withdrawalId).
			First(&withdrawal).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAffiliateWithdrawalNotFound
			}
			return err
		}
		if withdrawal.Status != AffiliateWithdrawalStatusPending {
			return ErrAffiliateWithdrawalStatusInvalid
		}
		userId = withdrawal.UserId
		quota = withdrawal.Quota
		if err := tx.Model(&AffiliateWithdrawal{}).Where("id = ?", withdrawal.Id).Updates(map[string]interface{}{
			"status":        status,
			"reject_reason": reason,
			"reviewer_id":   reviewerId,
			"reviewed_at":   common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		if approve {
			return nil
		}
		return tx.Model(&User{}).Where("id = ?", withdrawal.UserId).Update("aff_quota", gorm.Expr("aff_quota + ?", withdrawal.Quota)).Error
	})
	if err != nil {
		return err
	}
	if approve {
		RecordLogWithAdminInfo(userId, LogTypeManage, fmt.Sprintf("管理员通过邀请奖励提现申请，扣除 %s", logger.LogQuota(quota)), map[string]interface{}{"admin_id": reviewerId})
	} else {
		RecordLogWithAdminInfo(userId, LogTypeManage, fmt.Sprintf("管理员拒绝邀请奖励提现申请，返还 %s", logger.LogQuota(quota)), map[string]interface{}{"admin_id": reviewerId, "reject_reason": reason})
	}
	return nil
}

func GetAffiliateWithdrawals(userId int, status string, pageInfo *common.PageInfo) (withdrawals []*AffiliateWithdrawal, total int64, err error) {
	query := DB.Model(&AffiliateWithdrawal{})
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&withdrawals).Error
	return withdrawals, total, err
}
