package service

import (
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func addWalletConsumeResultToRelayInfo(relayInfo *relaycommon.RelayInfo, result model.WalletConsumeResult) {
	if relayInfo == nil {
		return
	}
	relayInfo.WalletQuotaConsumed += result.QuotaConsumed
	relayInfo.WalletGoldQuotaConsumed += result.GoldQuotaConsumed
	relayInfo.WalletGoldQuotaEquivalentConsume += result.GoldQuotaEquivalentConsume
	relayInfo.WalletRewardableConsumed += result.RewardableConsumed
}

func relayInfoWalletConsumeResult(relayInfo *relaycommon.RelayInfo) model.WalletConsumeResult {
	if relayInfo == nil {
		return model.WalletConsumeResult{}
	}
	return model.WalletConsumeResult{
		QuotaConsumed:              relayInfo.WalletQuotaConsumed,
		GoldQuotaConsumed:          relayInfo.WalletGoldQuotaConsumed,
		GoldQuotaEquivalentConsume: relayInfo.WalletGoldQuotaEquivalentConsume,
		RewardableConsumed:         relayInfo.WalletRewardableConsumed,
	}
}

func setRelayInfoWalletConsumeResult(relayInfo *relaycommon.RelayInfo, result model.WalletConsumeResult) {
	if relayInfo == nil {
		return
	}
	relayInfo.WalletQuotaConsumed = result.QuotaConsumed
	relayInfo.WalletGoldQuotaConsumed = result.GoldQuotaConsumed
	relayInfo.WalletGoldQuotaEquivalentConsume = result.GoldQuotaEquivalentConsume
	relayInfo.WalletRewardableConsumed = result.RewardableConsumed
}

func splitWalletRefund(source *model.WalletConsumeResult, amount int) model.WalletConsumeResult {
	if source == nil || amount <= 0 {
		return model.WalletConsumeResult{}
	}
	if amount > source.TotalConsumed() {
		amount = source.TotalConsumed()
	}

	toRefund := model.WalletConsumeResult{}
	remaining := amount

	fromGoldEquivalent := minIntService(source.GoldQuotaEquivalentConsume, remaining)
	if fromGoldEquivalent > 0 {
		goldToRefund := model.GoldCostForQuota(fromGoldEquivalent)
		if fromGoldEquivalent == source.GoldQuotaEquivalentConsume || goldToRefund > source.GoldQuotaConsumed {
			goldToRefund = source.GoldQuotaConsumed
		}
		toRefund.GoldQuotaConsumed = goldToRefund
		toRefund.GoldQuotaEquivalentConsume = fromGoldEquivalent
		source.GoldQuotaConsumed -= goldToRefund
		source.GoldQuotaEquivalentConsume -= fromGoldEquivalent
		remaining -= fromGoldEquivalent
	}

	fromQuota := minIntService(source.QuotaConsumed, remaining)
	if fromQuota > 0 {
		toRefund.QuotaConsumed = fromQuota
		source.QuotaConsumed -= fromQuota
		remaining -= fromQuota

		fromRewardable := minIntService(source.RewardableConsumed, fromQuota)
		toRefund.RewardableConsumed = fromRewardable
		source.RewardableConsumed -= fromRewardable
	}

	if source.QuotaConsumed < 0 {
		source.QuotaConsumed = 0
	}
	if source.GoldQuotaConsumed < 0 {
		source.GoldQuotaConsumed = 0
	}
	if source.GoldQuotaEquivalentConsume < 0 {
		source.GoldQuotaEquivalentConsume = 0
	}
	if source.RewardableConsumed < 0 {
		source.RewardableConsumed = 0
	}
	return toRefund
}
