package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func insertAffiliateTestUser(t *testing.T, username string, inviterId int) *User {
	t.Helper()
	user := &User{
		Username:    username,
		Password:    "password123",
		DisplayName: username,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		AffCode:     common.GetRandomString(8),
		InviterId:   inviterId,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func setAffiliatePaymentCompliance(t *testing.T, confirmed bool, firstTopUpRatio float64) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	oldPaymentSetting := *paymentSetting
	oldFirstTopUpRatio := common.AffFirstTopUpRewardRatio

	paymentSetting.ComplianceConfirmed = confirmed
	if confirmed {
		paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	} else {
		paymentSetting.ComplianceTermsVersion = ""
	}
	common.AffFirstTopUpRewardRatio = firstTopUpRatio

	t.Cleanup(func() {
		*paymentSetting = oldPaymentSetting
		common.AffFirstTopUpRewardRatio = oldFirstTopUpRatio
	})
}

func setAffiliateConsumptionRatio(t *testing.T, ratio float64) {
	t.Helper()
	oldRatio := common.AffConsumptionRewardRatio
	common.AffConsumptionRewardRatio = ratio
	t.Cleanup(func() {
		common.AffConsumptionRewardRatio = oldRatio
	})
}

func TestUserInsertIncrementsInviteCountWithoutRegistrationReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, false, 0)
	oldQuotaForNewUser := common.QuotaForNewUser
	oldQuotaForInvitee := common.QuotaForInvitee
	oldQuotaForInviter := common.QuotaForInviter
	common.QuotaForNewUser = 0
	common.QuotaForInvitee = 0
	common.QuotaForInviter = 0
	t.Cleanup(func() {
		common.QuotaForNewUser = oldQuotaForNewUser
		common.QuotaForInvitee = oldQuotaForInvitee
		common.QuotaForInviter = oldQuotaForInviter
	})

	inviter := insertAffiliateTestUser(t, "affiliate-inviter", 0)
	invitee := &User{
		Username:    "affiliate-invitee",
		Password:    "password123",
		DisplayName: "affiliate-invitee",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		InviterId:   inviter.Id,
	}
	require.NoError(t, invitee.Insert(inviter.Id))

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 1, updatedInviter.AffCount)
	assert.Equal(t, 0, updatedInviter.AffQuota)
	assert.Equal(t, 0, updatedInviter.AffHistoryQuota)
}

func TestReconcileAffiliateInviteCountsUsesSavedInviterRelations(t *testing.T) {
	truncateTables(t)
	inviter := insertAffiliateTestUser(t, "reconcile-inviter", 0)
	insertAffiliateTestUser(t, "reconcile-invitee", inviter.Id)

	require.NoError(t, ReconcileAffiliateInviteCounts())

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 1, updatedInviter.AffCount)
}

func TestAdminAddUserQuotaCreatesTopUpWithoutFirstTopUpReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 10)

	inviter := insertAffiliateTestUser(t, "admin-topup-inviter", 0)
	invitee := insertAffiliateTestUser(t, "admin-topup-invitee", inviter.Id)

	require.NoError(t, AdminAddUserQuota(invitee.Id, 1000, 99, "127.0.0.1"))

	var topUp TopUp
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).First(&topUp).Error)
	assert.Equal(t, int64(1000), topUp.Amount)
	assert.Equal(t, PaymentMethodAdmin, topUp.PaymentMethod)
	assert.Equal(t, PaymentProviderAdmin, topUp.PaymentProvider)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	assert.Equal(t, TopUpCreditTypeAdmin, topUp.CreditType)
	assert.False(t, topUp.RewardEligible)

	var updatedInvitee User
	require.NoError(t, DB.First(&updatedInvitee, invitee.Id).Error)
	assert.Equal(t, 1000, updatedInvitee.Quota)
	assert.Equal(t, 0, updatedInvitee.RewardableQuota)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 0, updatedInviter.AffQuota)
	assert.Equal(t, 0, updatedInviter.AffHistoryQuota)

	var rewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("inviter_id = ? AND invitee_id = ?", inviter.Id, invitee.Id).Count(&rewardCount).Error)
	assert.Equal(t, int64(0), rewardCount)
}

func TestRedeemCreatesTopUpAndFirstTopUpReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 20)

	inviter := insertAffiliateTestUser(t, "redeem-inviter", 0)
	invitee := insertAffiliateTestUser(t, "redeem-invitee", inviter.Id)
	redemption := &Redemption{
		UserId:      inviter.Id,
		Key:         common.GetUUID(),
		Status:      common.RedemptionCodeStatusEnabled,
		Name:        "test redeem",
		Quota:       500,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)

	quota, quotaType, err := Redeem(redemption.Key, invitee.Id)
	require.NoError(t, err)
	assert.Equal(t, 500, quota)
	assert.Equal(t, RedemptionQuotaTypeQuota, quotaType)

	var topUp TopUp
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).First(&topUp).Error)
	assert.Equal(t, int64(500), topUp.Amount)
	assert.Equal(t, PaymentMethodRedemption, topUp.PaymentMethod)
	assert.Equal(t, PaymentProviderRedemption, topUp.PaymentProvider)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 100, updatedInviter.AffQuota)
	assert.Equal(t, 100, updatedInviter.AffHistoryQuota)

	var updatedRedemption Redemption
	require.NoError(t, DB.First(&updatedRedemption, redemption.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, updatedRedemption.Status)
	assert.Equal(t, invitee.Id, updatedRedemption.UsedUserId)
}

func TestBackfillRedemptionTopUpsIsIdempotentAndGrantsFirstTopUpReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 10)

	inviter := insertAffiliateTestUser(t, "backfill-inviter", 0)
	invitee := insertAffiliateTestUser(t, "backfill-invitee", inviter.Id)
	redemptions := []*Redemption{
		{
			UserId:       inviter.Id,
			Key:          common.GetUUID(),
			Status:       common.RedemptionCodeStatusUsed,
			Name:         "legacy one",
			Quota:        1000,
			CreatedTime:  100,
			RedeemedTime: 200,
			UsedUserId:   invitee.Id,
		},
		{
			UserId:       inviter.Id,
			Key:          common.GetUUID(),
			Status:       common.RedemptionCodeStatusUsed,
			Name:         "legacy two",
			Quota:        2000,
			CreatedTime:  300,
			RedeemedTime: 400,
			UsedUserId:   invitee.Id,
		},
	}
	for _, redemption := range redemptions {
		require.NoError(t, DB.Create(redemption).Error)
	}

	require.NoError(t, BackfillRedemptionTopUps())
	require.NoError(t, BackfillRedemptionTopUps())

	var topUpCount int64
	require.NoError(t, DB.Model(&TopUp{}).Where("user_id = ? AND payment_method = ?", invitee.Id, PaymentMethodRedemption).Count(&topUpCount).Error)
	assert.Equal(t, int64(2), topUpCount)

	var firstTopUp TopUp
	require.NoError(t, DB.Where("trade_no = ?", "RDM"+strconv.Itoa(redemptions[0].Id)+"USR"+strconv.Itoa(invitee.Id)+"LEGACY").First(&firstTopUp).Error)
	assert.Equal(t, int64(1000), firstTopUp.Amount)
	assert.Equal(t, int64(200), firstTopUp.CreateTime)
	assert.Equal(t, int64(200), firstTopUp.CompleteTime)

	var rewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("inviter_id = ? AND invitee_id = ?", inviter.Id, invitee.Id).Count(&rewardCount).Error)
	assert.Equal(t, int64(1), rewardCount)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 100, updatedInviter.AffQuota)
	assert.Equal(t, 100, updatedInviter.AffHistoryQuota)
}

func TestBackfillAffiliateFirstTopUpRewardsAfterRatioEnabled(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, false, 0)

	inviter := insertAffiliateTestUser(t, "late-ratio-inviter", 0)
	invitee := insertAffiliateTestUser(t, "late-ratio-invitee", inviter.Id)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		_, err := createSuccessfulTopUpAtTx(
			tx,
			invitee.Id,
			1000,
			0,
			"late-ratio-topup",
			PaymentMethodRedemption,
			PaymentProviderRedemption,
			1000,
		)
		return err
	}))

	require.NoError(t, BackfillAffiliateFirstTopUpRewards())
	var rewardCountBefore int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("inviter_id = ? AND invitee_id = ?", inviter.Id, invitee.Id).Count(&rewardCountBefore).Error)
	assert.Equal(t, int64(0), rewardCountBefore)

	setAffiliatePaymentCompliance(t, true, 10)
	require.NoError(t, BackfillAffiliateFirstTopUpRewards())
	require.NoError(t, BackfillAffiliateFirstTopUpRewards())

	var rewardCountAfter int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("inviter_id = ? AND invitee_id = ?", inviter.Id, invitee.Id).Count(&rewardCountAfter).Error)
	assert.Equal(t, int64(1), rewardCountAfter)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 100, updatedInviter.AffQuota)
	assert.Equal(t, 100, updatedInviter.AffHistoryQuota)
}

func TestFirstPaidTopUpConsumptionDoesNotGrantConsumptionReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 10)
	setAffiliateConsumptionRatio(t, 10)

	inviter := insertAffiliateTestUser(t, "first-consume-inviter", 0)
	invitee := insertAffiliateTestUser(t, "first-consume-invitee", inviter.Id)

	var topUp *TopUp
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		topUp, err = createSuccessfulTopUpAtTx(tx, invitee.Id, 1000, 0, "first-paid-topup", PaymentMethodCreem, PaymentProviderCreem, 1000)
		if err != nil {
			return err
		}
		if err = tx.Model(&User{}).Where("id = ?", invitee.Id).Update("quota", gorm.Expr("quota + ?", 1000)).Error; err != nil {
			return err
		}
		if _, err = markTopUpCreditClassificationTx(tx, topUp, 1000); err != nil {
			return err
		}
		_, _, err = GrantAffiliateFirstTopUpRewardTx(tx, topUp, 1000)
		return err
	}))

	var updatedInvitee User
	require.NoError(t, DB.First(&updatedInvitee, invitee.Id).Error)
	assert.Equal(t, 1000, updatedInvitee.Quota)
	assert.Equal(t, 0, updatedInvitee.RewardableQuota)

	result, err := ConsumeUserWalletQuota(invitee.Id, 500)
	require.NoError(t, err)
	assert.Equal(t, 500, result.QuotaConsumed)
	assert.Equal(t, 0, result.RewardableConsumed)

	_, granted, err := GrantAffiliateConsumptionReward(invitee.Id, result.RewardableConsumed, "first-paid-consume")
	require.NoError(t, err)
	assert.Equal(t, 0, granted)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 100, updatedInviter.AffQuota)
	assert.Equal(t, 100, updatedInviter.AffHistoryQuota)

	var consumptionRewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).
		Where("source_type = ? AND inviter_id = ? AND invitee_id = ?", AffiliateRewardSourceConsumption, inviter.Id, invitee.Id).
		Count(&consumptionRewardCount).Error)
	assert.Equal(t, int64(0), consumptionRewardCount)
}

func TestSecondPaidTopUpConsumptionGrantsOnlyRewardableConsumptionReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 10)
	setAffiliateConsumptionRatio(t, 10)

	inviter := insertAffiliateTestUser(t, "second-consume-inviter", 0)
	invitee := insertAffiliateTestUser(t, "second-consume-invitee", inviter.Id)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		firstTopUp, err := createSuccessfulTopUpAtTx(tx, invitee.Id, 1000, 0, "second-case-first", PaymentMethodCreem, PaymentProviderCreem, 1000)
		if err != nil {
			return err
		}
		secondTopUp, err := createSuccessfulTopUpAtTx(tx, invitee.Id, 2000, 0, "second-case-second", PaymentMethodCreem, PaymentProviderCreem, 2000)
		if err != nil {
			return err
		}
		if err = tx.Model(&User{}).Where("id = ?", invitee.Id).Update("quota", gorm.Expr("quota + ?", 3000)).Error; err != nil {
			return err
		}
		if _, err = markTopUpCreditClassificationTx(tx, firstTopUp, 1000); err != nil {
			return err
		}
		if _, _, err = GrantAffiliateFirstTopUpRewardTx(tx, firstTopUp, 1000); err != nil {
			return err
		}
		_, err = markTopUpCreditClassificationTx(tx, secondTopUp, 2000)
		return err
	}))

	var before User
	require.NoError(t, DB.First(&before, invitee.Id).Error)
	assert.Equal(t, 3000, before.Quota)
	assert.Equal(t, 2000, before.RewardableQuota)

	result, err := ConsumeUserWalletQuota(invitee.Id, 1500)
	require.NoError(t, err)
	assert.Equal(t, 1500, result.QuotaConsumed)
	assert.Equal(t, 500, result.RewardableConsumed)

	_, granted, err := GrantAffiliateConsumptionReward(invitee.Id, result.RewardableConsumed, "second-paid-consume")
	require.NoError(t, err)
	assert.Equal(t, 50, granted)

	var after User
	require.NoError(t, DB.First(&after, invitee.Id).Error)
	assert.Equal(t, 1500, after.Quota)
	assert.Equal(t, 1500, after.RewardableQuota)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 150, updatedInviter.AffQuota)
	assert.Equal(t, 150, updatedInviter.AffHistoryQuota)
}

func TestGiftedPortionOfLaterPaidTopUpDoesNotGrantConsumptionReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 10)
	setAffiliateConsumptionRatio(t, 10)

	inviter := insertAffiliateTestUser(t, "gifted-paid-inviter", 0)
	invitee := insertAffiliateTestUser(t, "gifted-paid-invitee", inviter.Id)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		firstTopUp, err := createSuccessfulTopUpAtTx(tx, invitee.Id, 1000, 0, "gifted-case-first", PaymentMethodCreem, PaymentProviderCreem, 1000)
		if err != nil {
			return err
		}
		secondTopUp, err := createSuccessfulTopUpAtTx(tx, invitee.Id, 2000, 0, "gifted-case-second", PaymentMethodCreem, PaymentProviderCreem, 2000)
		if err != nil {
			return err
		}
		if err = tx.Model(&User{}).Where("id = ?", invitee.Id).Update("quota", gorm.Expr("quota + ?", 3000)).Error; err != nil {
			return err
		}
		if _, err = markTopUpCreditClassificationTx(tx, firstTopUp, 1000); err != nil {
			return err
		}
		if _, _, err = GrantAffiliateFirstTopUpRewardTx(tx, firstTopUp, 1000); err != nil {
			return err
		}
		_, err = markTopUpCreditClassificationWithRewardableTx(tx, secondTopUp, 2000, 1200)
		return err
	}))

	var before User
	require.NoError(t, DB.First(&before, invitee.Id).Error)
	assert.Equal(t, 3000, before.Quota)
	assert.Equal(t, 1200, before.RewardableQuota)

	result, err := ConsumeUserWalletQuota(invitee.Id, 3000)
	require.NoError(t, err)
	assert.Equal(t, 3000, result.QuotaConsumed)
	assert.Equal(t, 1200, result.RewardableConsumed)

	_, granted, err := GrantAffiliateConsumptionReward(invitee.Id, result.RewardableConsumed, "gifted-paid-consume")
	require.NoError(t, err)
	assert.Equal(t, 120, granted)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 220, updatedInviter.AffQuota)
	assert.Equal(t, 220, updatedInviter.AffHistoryQuota)
}

func TestGoldRedemptionDoesNotGrantFirstOrConsumptionReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 20)
	setAffiliateConsumptionRatio(t, 10)
	oldGoldRate := common.GoldQuotaExchangeRate
	common.GoldQuotaExchangeRate = 1
	t.Cleanup(func() {
		common.GoldQuotaExchangeRate = oldGoldRate
	})

	inviter := insertAffiliateTestUser(t, "gold-redeem-inviter", 0)
	invitee := insertAffiliateTestUser(t, "gold-redeem-invitee", inviter.Id)
	redemption := &Redemption{
		UserId:      inviter.Id,
		Key:         common.GetUUID(),
		Status:      common.RedemptionCodeStatusEnabled,
		Name:        "gold redeem",
		Quota:       1000,
		QuotaType:   RedemptionQuotaTypeGold,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)

	quota, quotaType, err := Redeem(redemption.Key, invitee.Id)
	require.NoError(t, err)
	assert.Equal(t, 1000, quota)
	assert.Equal(t, RedemptionQuotaTypeGold, quotaType)

	var topUp TopUp
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).First(&topUp).Error)
	assert.Equal(t, TopUpCreditTypeGold, topUp.CreditType)
	assert.False(t, topUp.RewardEligible)

	var inviteeAfterRedeem User
	require.NoError(t, DB.First(&inviteeAfterRedeem, invitee.Id).Error)
	assert.Equal(t, 0, inviteeAfterRedeem.Quota)
	assert.Equal(t, 1000, inviteeAfterRedeem.GoldQuota)
	assert.Equal(t, 0, inviteeAfterRedeem.RewardableQuota)

	result, err := ConsumeUserWalletQuota(invitee.Id, 300)
	require.NoError(t, err)
	assert.Equal(t, 0, result.QuotaConsumed)
	assert.Equal(t, 300, result.GoldQuotaConsumed)
	assert.Equal(t, 300, result.GoldQuotaEquivalentConsume)
	assert.Equal(t, 0, result.RewardableConsumed)

	_, granted, err := GrantAffiliateConsumptionReward(invitee.Id, result.RewardableConsumed, "gold-consume")
	require.NoError(t, err)
	assert.Equal(t, 0, granted)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 0, updatedInviter.AffQuota)
	assert.Equal(t, 0, updatedInviter.AffHistoryQuota)
}

func TestAffiliateTransferAndAdminGiftConsumptionDoNotGrantConsumptionReward(t *testing.T) {
	truncateTables(t)
	setAffiliatePaymentCompliance(t, true, 0)
	setAffiliateConsumptionRatio(t, 10)

	inviter := insertAffiliateTestUser(t, "gift-consume-inviter", 0)
	invitee := insertAffiliateTestUser(t, "gift-consume-invitee", inviter.Id)
	affiliateTransferQuota := int(common.QuotaPerUnit)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", invitee.Id).Update("aff_quota", affiliateTransferQuota).Error)
	require.NoError(t, invitee.TransferAffQuotaToQuota(affiliateTransferQuota))
	require.NoError(t, AdminAddUserQuota(invitee.Id, 2000, 99, "127.0.0.1"))

	var before User
	require.NoError(t, DB.First(&before, invitee.Id).Error)
	assert.Equal(t, affiliateTransferQuota+2000, before.Quota)
	assert.Equal(t, 0, before.RewardableQuota)

	result, err := ConsumeUserWalletQuota(invitee.Id, 2500)
	require.NoError(t, err)
	assert.Equal(t, 2500, result.QuotaConsumed)
	assert.Equal(t, 0, result.RewardableConsumed)

	_, granted, err := GrantAffiliateConsumptionReward(invitee.Id, result.RewardableConsumed, "gift-consume")
	require.NoError(t, err)
	assert.Equal(t, 0, granted)

	var updatedInviter User
	require.NoError(t, DB.First(&updatedInviter, inviter.Id).Error)
	assert.Equal(t, 0, updatedInviter.AffQuota)
	assert.Equal(t, 0, updatedInviter.AffHistoryQuota)
}
