// Package plugin 提供插件生命周期管理、市场和请求转发。
package plugin

import (
	"context"
	"strings"
	"sync"

	goplugin "github.com/hashicorp/go-plugin"

	sdk "github.com/DouDOU-start/airgate-sdk"
	sdkgrpc "github.com/DouDOU-start/airgate-sdk/grpc"

	"github.com/DouDOU-start/airgate-core/ent"
)

// PluginInstance 运行中的插件实例。
type PluginInstance struct {
	Name               string
	SourceName         string
	BinaryDir          string
	DisplayName        string
	Version            string
	Author             string
	Platform           string
	Type               string // "gateway", "extension"
	InstructionPresets []string
	ConfigSchema       []sdk.ConfigField
	Client             *goplugin.Client
	Gateway            *sdkgrpc.GatewayGRPCClient
	Extension          *sdkgrpc.ExtensionGRPCClient

	// 后台任务调度上下文。stopBackground 由 Core 调度器创建，用于停止
	// 该插件实例的所有后台任务 goroutine。stopPlugin 时调用。
	stopBackground context.CancelFunc
}

// Manager 插件管理器。
type Manager struct {
	pluginDir    string
	logLevel     string
	coreDSN      string      // core 数据库 DSN，启动插件时自动注入到 Init Config 的 db_dsn 字段
	coreBaseURL  string      // core 自身 HTTP 监听 URL，注入到 Init Config 的 core_base_url 字段（供 health 等插件回调）
	apiKeySecret string      // 用于解密 settings.admin_api_key_encrypted，注入到 Init Config 的 admin_api_key 字段
	db           *ent.Client // 用于读取/持久化插件配置

	mu        sync.RWMutex
	instances map[string]*PluginInstance
	aliases   map[string]string
	devPaths  map[string]string

	modelCache        map[string][]sdk.ModelInfo
	routeCache        map[string][]sdk.RouteDefinition
	credCache         map[string][]sdk.CredentialField
	accountTypeCache  map[string][]sdk.AccountType
	frontendPageCache map[string][]sdk.FrontendPage
}

// PluginMeta 插件运行时元信息。
type PluginMeta struct {
	Name               string
	DisplayName        string
	Version            string
	Author             string
	Type               string
	Platform           string
	AccountTypes       []sdk.AccountType
	FrontendPages      []sdk.FrontendPage
	InstructionPresets []string
	ConfigSchema       []sdk.ConfigField
	Config             map[string]string
	HasWebAssets       bool
	IsDev              bool
}

// NewManager 创建插件管理器。
//
// coreBaseURL  为 core 自身的 HTTP 监听根地址（如 http://127.0.0.1:9517），用于让
//
//	extension 插件回调 core admin API（典型场景：airgate-health 调
//	POST /api/v1/admin/accounts/:id/test）。空串则不注入。
//
// apiKeySecret 用于解密 settings 表里的 admin_api_key_encrypted；空串或解密失败时
//
//	不注入 admin_api_key，插件会以软失败方式运行（与现状一致）。
func NewManager(pluginDir, logLevel, coreDSN, coreBaseURL, apiKeySecret string, db *ent.Client) *Manager {
	return &Manager{
		pluginDir:         pluginDir,
		logLevel:          logLevel,
		coreDSN:           coreDSN,
		coreBaseURL:       coreBaseURL,
		apiKeySecret:      apiKeySecret,
		db:                db,
		instances:         make(map[string]*PluginInstance),
		aliases:           make(map[string]string),
		devPaths:          make(map[string]string),
		modelCache:        make(map[string][]sdk.ModelInfo),
		routeCache:        make(map[string][]sdk.RouteDefinition),
		credCache:         make(map[string][]sdk.CredentialField),
		accountTypeCache:  make(map[string][]sdk.AccountType),
		frontendPageCache: make(map[string][]sdk.FrontendPage),
	}
}

func normalizePluginName(name string) string {
	return strings.TrimSpace(name)
}

func canonicalPluginName(info sdk.PluginInfo, fallback string) string {
	if id := normalizePluginName(info.ID); id != "" {
		return id
	}
	return normalizePluginName(fallback)
}
