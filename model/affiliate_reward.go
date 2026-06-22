package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	AffiliateRewardSourceFirstTopUp   = "first_topup"
	AffiliateRewardSourceConsumption  = "consumption"
	affiliateRewardSourceIDFirstTopUp = "invitee:%d"
)

type AffiliateReward struct {
	Id         int     `json:"id"`
	InviterId  int     `json:"inviter_id" gorm:"index"`
	InviteeId  int     `json:"invitee_id" gorm:"index"`
	SourceType string  `json:"source_type" gorm:"type:varchar(32);index:idx_affiliate_reward_source,unique"`
	SourceId   string  `json:"source_id" gorm:"type:varchar(128);index:idx_affiliate_reward_source,unique"`
	SourceRef  string  `json:"source_ref" gorm:"type:varchar(255);default:''"`
	Quota      int     `json:"quota" gorm:"default:0"`
	Rate       float64 `json:"rate" gorm:"default:0"`
	CreatedAt  int64   `json:"created_at" gorm:"autoCreateTime"`
}

func calculateAffiliateRewardQuota(baseQuota int, ratio float64) int {
	if baseQuota <= 0 || ratio <= 0 {
		return 0
	}
	reward := decimal.NewFromInt(int64(baseQuota)).
		Mul(decimal.NewFromFloat(ratio)).
		Div(decimal.NewFromInt(100)).
		IntPart()
	if reward <= 0 {
		return 0
	}
	return int(reward)
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "duplicated") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique index") ||
		strings.Contains(msg, "sqlstate 23505")
}

func grantAffiliateRewardTx(tx *gorm.DB, inviterId int, inviteeId int, sourceType string, sourceId string, sourceRef string, quota int, rate float64) (int, error) {
	if inviterId <= 0 || inviteeId <= 0 || quota <= 0 {
		return 0, nil
	}
	reward := &AffiliateReward{
		InviterId:  inviterId,
		InviteeId:  inviteeId,
		SourceType: sourceType,
		SourceId:   sourceId,
		SourceRef:  sourceRef,
		Quota:      quota,
		Rate:       rate,
	}
	if err := tx.Create(reward).Error; err != nil {
		if isDuplicateKeyError(err) {
			return 0, nil
		}
		return 0, err
	}
	if err := tx.Model(&User{}).Where("id = ?", inviterId).Updates(map[string]interface{}{
		"aff_quota":   gorm.Expr("aff_quota + ?", quota),
		"aff_history": gorm.Expr("aff_history + ?", quota),
	}).Error; err != nil {
		return 0, err
	}
	return quota, nil
}

func GrantAffiliateFirstTopUpRewardTx(tx *gorm.DB, topUp *TopUp, rechargedQuota int) (int, int, error) {
	if topUp == nil || topUp.UserId <= 0 || topUp.Id <= 0 || rechargedQuota <= 0 {
		return 0, 0, nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() || common.AffFirstTopUpRewardRatio <= 0 {
		return 0, 0, nil
	}

	var invitee User
	if err := tx.Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return 0, 0, err
	}
	if invitee.InviterId <= 0 {
		return 0, 0, nil
	}

	var previousSuccess int64
	if err := tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND id <> ?", topUp.UserId, common.TopUpStatusSuccess, topUp.Id).
		Count(&previousSuccess).Error; err != nil {
		return 0, 0, err
	}
	if previousSuccess > 0 {
		return invitee.InviterId, 0, nil
	}

	rewardQuota := calculateAffiliateRewardQuota(rechargedQuota, common.AffFirstTopUpRewardRatio)
	if rewardQuota <= 0 {
		return invitee.InviterId, 0, nil
	}
	sourceId := fmt.Sprintf(affiliateRewardSourceIDFirstTopUp, topUp.UserId)
	granted, err := grantAffiliateRewardTx(
		tx,
		invitee.InviterId,
		topUp.UserId,
		AffiliateRewardSourceFirstTopUp,
		sourceId,
		topUp.TradeNo,
		rewardQuota,
		common.AffFirstTopUpRewardRatio,
	)
	return invitee.InviterId, granted, err
}

func GrantAffiliateFirstTopUpReward(topUp *TopUp, rechargedQuota int) (int, int, error) {
	var inviterId int
	var granted int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		inviterId, granted, err = GrantAffiliateFirstTopUpRewardTx(tx, topUp, rechargedQuota)
		return err
	})
	if err == nil && granted > 0 {
		RecordLog(inviterId, LogTypeSystem, fmt.Sprintf("邀请用户首次充值返佣 %s", logger.LogQuota(granted)))
	}
	return inviterId, granted, err
}

func GrantAffiliateConsumptionReward(inviteeId int, consumedQuota int, requestId string) (int, int, error) {
	if inviteeId <= 0 || consumedQuota <= 0 {
		return 0, 0, nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() || common.AffConsumptionRewardRatio <= 0 {
		return 0, 0, nil
	}

	sourceId := strings.TrimSpace(requestId)
	if sourceId == "" {
		sourceId = fmt.Sprintf("consume:%d:%s", inviteeId, common.GetUUID())
	} else {
		sourceId = "request:" + sourceId
	}

	var inviterId int
	var granted int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var invitee User
		if err := tx.Select("id", "inviter_id").Where("id = ?", inviteeId).First(&invitee).Error; err != nil {
			return err
		}
		if invitee.InviterId <= 0 {
			return nil
		}
		inviterId = invitee.InviterId
		rewardQuota := calculateAffiliateRewardQuota(consumedQuota, common.AffConsumptionRewardRatio)
		if rewardQuota <= 0 {
			return nil
		}
		var err error
		granted, err = grantAffiliateRewardTx(
			tx,
			invitee.InviterId,
			inviteeId,
			AffiliateRewardSourceConsumption,
			sourceId,
			requestId,
			rewardQuota,
			common.AffConsumptionRewardRatio,
		)
		return err
	})
	if err == nil && granted > 0 {
		RecordLog(inviterId, LogTypeSystem, fmt.Sprintf("邀请用户消费返现 %s", logger.LogQuota(granted)))
	}
	return inviterId, granted, err
}
