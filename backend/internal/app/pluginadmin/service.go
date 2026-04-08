package pluginadmin

import (
	"context"

	sdk "github.com/DouDOU-start/airgate-sdk"
)

// Service 提供插件管理用例编排。
type Service struct {
	manager     Manager
	marketplace MarketplaceReader
}

// NewService 创建插件管理服务。
func NewService(manager Manager, marketplace MarketplaceReader) *Service {
	return &Service{
		manager:     manager,
		marketplace: marketplace,
	}
}

// List 返回运行中的插件列表。
func (s *Service) List() []PluginMeta {
	allMeta := s.manager.GetAllPluginMeta()
	result := make([]PluginMeta, 0, len(allMeta))
	for _, item := range allMeta {
		result = append(result, PluginMeta{
			Name:               item.Name,
			DisplayName:        item.DisplayName,
			Version:            item.Version,
			Author:             item.Author,
			Type:               item.Type,
			Platform:           item.Platform,
			AccountTypes:       append([]sdk.AccountType(nil), item.AccountTypes...),
			FrontendPages:      append([]sdk.FrontendPage(nil), item.FrontendPages...),
			InstructionPresets: append([]string(nil), item.InstructionPresets...),
			ConfigSchema:       append([]sdk.ConfigField(nil), item.ConfigSchema...),
			HasWebAssets:       item.HasWebAssets,
			IsDev:              item.IsDev,
		})
	}
	return result
}

// GetConfig 读取插件持久化的配置（隐藏 password 类型字段的值，仅返回 key 列表）。
func (s *Service) GetConfig(ctx context.Context, name string) (map[string]string, error) {
	return s.manager.GetPluginConfig(ctx, name)
}

// UpdateConfig 写入插件配置并触发 reload。
//
// 注意 reload 失败不会回滚配置：用户应当看到错误后修改配置再重试。
func (s *Service) UpdateConfig(ctx context.Context, name string, config map[string]string) error {
	if err := s.manager.UpdatePluginConfig(ctx, name, config); err != nil {
		return err
	}
	return s.manager.ReloadInstance(ctx, name)
}

// Upload 从二进制安装插件。
func (s *Service) Upload(ctx context.Context, name string, binary []byte) error {
	copied := append([]byte(nil), binary...)
	return s.manager.InstallFromBinary(ctx, name, copied)
}

// InstallFromGithub 从 GitHub 安装插件。
func (s *Service) InstallFromGithub(ctx context.Context, repo string) error {
	return s.manager.InstallFromGithub(ctx, repo)
}

// Uninstall 卸载插件。
func (s *Service) Uninstall(ctx context.Context, name string) error {
	return s.manager.Uninstall(ctx, name)
}

// Reload 热加载插件。
func (s *Service) Reload(ctx context.Context, name string) error {
	if !s.manager.IsDev(name) {
		return ErrPluginNotDev
	}
	return s.manager.ReloadDev(ctx, name)
}

// Proxy 转发插件管理请求。
func (s *Service) Proxy(ctx context.Context, input ProxyInput) (ProxyResult, error) {
	inst := s.manager.GetInstance(input.Name)
	if inst == nil || inst.Gateway == nil {
		return ProxyResult{}, ErrPluginUnavailable
	}

	status, headers, body, err := inst.Gateway.HandleHTTPRequest(
		ctx,
		input.Method,
		input.Action,
		input.Query,
		input.Headers,
		input.Body,
	)
	if err != nil {
		return ProxyResult{}, err
	}

	return ProxyResult{
		StatusCode: status,
		Headers:    headers,
		Body:       body,
	}, nil
}

// RefreshMarketplace 强制从 GitHub 同步市场列表。
func (s *Service) RefreshMarketplace(ctx context.Context) error {
	return s.marketplace.SyncFromGithub(ctx)
}

// ListMarketplace 返回市场插件列表。
func (s *Service) ListMarketplace(ctx context.Context) ([]MarketplacePlugin, error) {
	items, err := s.marketplace.ListAvailable(ctx)
	if err != nil {
		return nil, err
	}

	installed := make(map[string]bool)
	for _, meta := range s.manager.GetAllPluginMeta() {
		installed[meta.Name] = true
	}

	result := make([]MarketplacePlugin, 0, len(items))
	for _, item := range items {
		result = append(result, MarketplacePlugin{
			Name:        item.Name,
			Version:     item.Version,
			Description: item.Description,
			Author:      item.Author,
			Type:        item.Type,
			GithubRepo:  item.GithubRepo,
			Installed:   installed[item.Name],
		})
	}
	return result, nil
}
