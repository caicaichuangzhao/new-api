package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type createAffiliateWithdrawalRequest struct {
	AlipayName    string `json:"alipay_name"`
	AlipayAccount string `json:"alipay_account"`
	Quota         int    `json:"quota"`
}

type reviewAffiliateWithdrawalRequest struct {
	Approved     *bool  `json:"approved"`
	Status       string `json:"status"`
	RejectReason string `json:"reject_reason"`
}

type affiliateWithdrawalResponse struct {
	*model.AffiliateWithdrawal
	Username     string `json:"username,omitempty"`
	ReviewerName string `json:"reviewer_name,omitempty"`
}

func buildAffiliateWithdrawalResponses(withdrawals []*model.AffiliateWithdrawal) []*affiliateWithdrawalResponse {
	responses := make([]*affiliateWithdrawalResponse, 0, len(withdrawals))
	usernameCache := map[int]string{}
	getName := func(userId int) string {
		if userId <= 0 {
			return ""
		}
		if name, ok := usernameCache[userId]; ok {
			return name
		}
		name, _ := model.GetUsernameById(userId, false)
		usernameCache[userId] = name
		return name
	}
	for _, withdrawal := range withdrawals {
		responses = append(responses, &affiliateWithdrawalResponse{
			AffiliateWithdrawal: withdrawal,
			Username:            getName(withdrawal.UserId),
			ReviewerName:        getName(withdrawal.ReviewerId),
		})
	}
	return responses
}

func CreateAffiliateWithdrawal(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	var req createAffiliateWithdrawalRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	withdrawal, err := model.CreateAffiliateWithdrawal(c.GetInt("id"), req.AlipayName, req.AlipayAccount, req.Quota)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, withdrawal)
}

func GetSelfAffiliateWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	withdrawals, total, err := model.GetAffiliateWithdrawals(c.GetInt("id"), c.Query("status"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildAffiliateWithdrawalResponses(withdrawals))
	common.ApiSuccess(c, pageInfo)
}

func CancelAffiliateWithdrawal(c *gin.Context) {
	withdrawalId, err := strconv.Atoi(c.Param("id"))
	if err != nil || withdrawalId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.CancelAffiliateWithdrawal(c.GetInt("id"), withdrawalId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminGetAffiliateWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := 0
	if parsed, err := strconv.Atoi(c.Query("user_id")); err == nil && parsed > 0 {
		userId = parsed
	}
	withdrawals, total, err := model.GetAffiliateWithdrawals(userId, c.Query("status"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildAffiliateWithdrawalResponses(withdrawals))
	common.ApiSuccess(c, pageInfo)
}

func AdminReviewAffiliateWithdrawal(c *gin.Context) {
	withdrawalId, err := strconv.Atoi(c.Param("id"))
	if err != nil || withdrawalId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var req reviewAffiliateWithdrawalRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	approve := false
	if req.Approved != nil {
		approve = *req.Approved
	} else if req.Status == model.AffiliateWithdrawalStatusApproved {
		approve = true
	} else if req.Status != model.AffiliateWithdrawalStatusRejected {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.ReviewAffiliateWithdrawal(withdrawalId, c.GetInt("id"), approve, req.RejectReason); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
