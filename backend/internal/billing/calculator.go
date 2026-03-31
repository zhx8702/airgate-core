// Package billing 提供费用计算和使用量异步记录
package billing

// Calculator 费用计算器
type Calculator struct{}

// NewCalculator 创建费用计算器
func NewCalculator() *Calculator {
	return &Calculator{}
}

// CalculateInput 计算输入参数
type CalculateInput struct {
	InputCost       float64 // 插件已计算的输入费用
	OutputCost      float64 // 插件已计算的输出费用
	CachedInputCost float64 // 插件已计算的缓存输入费用

	// 三层倍率
	GroupRateMultiplier   float64 // 分组倍率
	AccountRateMultiplier float64 // 账号倍率
	UserRateMultiplier    float64 // 用户自定义倍率（group_rates 中的值）
}

// CalculateResult 计算结果
type CalculateResult struct {
	InputCost             float64 // 输入费用
	OutputCost            float64 // 输出费用
	CachedInputCost       float64 // cached input 费用
	TotalCost             float64 // 原始成本 = input + cached_input + output
	ActualCost            float64 // 最终计费 = TotalCost * group * account * user
	RateMultiplier        float64 // 最终综合倍率
	AccountRateMultiplier float64 // 账号倍率
}

// Calculate 计算费用
// 插件层已完成单价 × token 的计算，Core 只做倍率乘法：
//
//	total_cost  = input_cost + cached_input_cost + output_cost
//	actual_cost = total_cost * group_rate * account_rate * user_rate
func (c *Calculator) Calculate(input CalculateInput) CalculateResult {
	totalCost := input.InputCost + input.OutputCost + input.CachedInputCost

	// 倍率默认为 1.0
	groupRate := input.GroupRateMultiplier
	if groupRate <= 0 {
		groupRate = 1.0
	}
	accountRate := input.AccountRateMultiplier
	if accountRate <= 0 {
		accountRate = 1.0
	}
	userRate := input.UserRateMultiplier
	if userRate <= 0 {
		userRate = 1.0
	}

	combinedRate := groupRate * accountRate * userRate

	return CalculateResult{
		InputCost:             input.InputCost,
		OutputCost:            input.OutputCost,
		CachedInputCost:       input.CachedInputCost,
		TotalCost:             totalCost,
		ActualCost:            totalCost * combinedRate,
		RateMultiplier:        combinedRate,
		AccountRateMultiplier: accountRate,
	}
}
