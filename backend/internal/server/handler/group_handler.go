package handler

import (
	"log/slog"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/DouDOU-start/airgate-core/ent"
	"github.com/DouDOU-start/airgate-core/ent/apikey"
	"github.com/DouDOU-start/airgate-core/ent/group"
	"github.com/DouDOU-start/airgate-core/ent/usagelog"
	"github.com/DouDOU-start/airgate-core/ent/user"
	"github.com/DouDOU-start/airgate-core/ent/usersubscription"
	"github.com/DouDOU-start/airgate-core/internal/server/dto"
	"github.com/DouDOU-start/airgate-core/internal/server/response"
)

// GroupHandler 分组管理 Handler
type GroupHandler struct {
	db *ent.Client
}

// NewGroupHandler 创建 GroupHandler
func NewGroupHandler(db *ent.Client) *GroupHandler {
	return &GroupHandler{db: db}
}

// ListGroups 查询分组列表
func (h *GroupHandler) ListGroups(c *gin.Context) {
	var page dto.PageReq
	if err := c.ShouldBindQuery(&page); err != nil {
		response.BindError(c, err)
		return
	}

	query := h.db.Group.Query()

	// 关键词搜索
	if page.Keyword != "" {
		query = query.Where(group.NameContains(page.Keyword))
	}

	// 平台筛选
	if platform := c.Query("platform"); platform != "" {
		query = query.Where(group.PlatformEQ(platform))
	}
	if serviceTier := c.Query("service_tier"); serviceTier != "" {
		query = query.Where(group.ServiceTierEQ(serviceTier))
	}

	// 总数
	total, err := query.Count(c.Request.Context())
	if err != nil {
		slog.Error("查询分组总数失败", "error", err)
		response.InternalError(c, "查询失败")
		return
	}

	// 分页查询
	groups, err := query.
		Offset((page.Page-1)*page.PageSize).
		Limit(page.PageSize).
		Order(ent.Desc(group.FieldSortWeight), ent.Desc(group.FieldCreatedAt)).
		All(c.Request.Context())
	if err != nil {
		slog.Error("查询分组列表失败", "error", err)
		response.InternalError(c, "查询失败")
		return
	}

	list := make([]dto.GroupResp, 0, len(groups))
	for _, g := range groups {
		list = append(list, toGroupResp(g))
	}

	response.Success(c, response.PagedData(list, int64(total), page.Page, page.PageSize))
}

// ListAvailableGroups 查询当前用户可用分组列表
func (h *GroupHandler) ListAvailableGroups(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, ok := userID.(int)
	if !ok {
		response.Unauthorized(c, "用户未认证")
		return
	}

	var page dto.PageReq
	if err := c.ShouldBindQuery(&page); err != nil {
		response.BindError(c, err)
		return
	}

	query := h.db.Group.Query().Where(
		group.Or(
			group.IsExclusiveEQ(false),
			group.And(
				group.IsExclusiveEQ(true),
				group.HasAllowedUsersWith(user.IDEQ(uid)),
			),
		),
	)

	if page.Keyword != "" {
		query = query.Where(group.NameContains(page.Keyword))
	}
	if platform := c.Query("platform"); platform != "" {
		query = query.Where(group.PlatformEQ(platform))
	}

	total, err := query.Count(c.Request.Context())
	if err != nil {
		slog.Error("查询用户可用分组总数失败", "error", err)
		response.InternalError(c, "查询失败")
		return
	}

	groups, err := query.
		Offset((page.Page-1)*page.PageSize).
		Limit(page.PageSize).
		Order(ent.Desc(group.FieldSortWeight), ent.Desc(group.FieldCreatedAt)).
		All(c.Request.Context())
	if err != nil {
		slog.Error("查询用户可用分组列表失败", "error", err)
		response.InternalError(c, "查询失败")
		return
	}

	list := make([]dto.GroupResp, 0, len(groups))
	for _, g := range groups {
		list = append(list, toGroupResp(g))
	}

	response.Success(c, response.PagedData(list, int64(total), page.Page, page.PageSize))
}

// GetGroup 获取分组详情
func (h *GroupHandler) GetGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的分组 ID")
		return
	}

	g, err := h.db.Group.Get(c.Request.Context(), id)
	if err != nil {
		if ent.IsNotFound(err) {
			response.NotFound(c, "分组不存在")
			return
		}
		slog.Error("查询分组失败", "error", err)
		response.InternalError(c, "查询失败")
		return
	}

	response.Success(c, toGroupResp(g))
}

// CreateGroup 创建分组
func (h *GroupHandler) CreateGroup(c *gin.Context) {
	var req dto.CreateGroupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BindError(c, err)
		return
	}

	builder := h.db.Group.Create().
		SetName(req.Name).
		SetPlatform(req.Platform).
		SetRateMultiplier(req.RateMultiplier).
		SetIsExclusive(req.IsExclusive).
		SetSubscriptionType(group.SubscriptionType(req.SubscriptionType)).
		SetServiceTier(req.ServiceTier).
		SetSortWeight(req.SortWeight)

	if req.Quotas != nil {
		builder = builder.SetQuotas(req.Quotas)
	}
	if req.ModelRouting != nil {
		builder = builder.SetModelRouting(req.ModelRouting)
	}

	g, err := builder.Save(c.Request.Context())
	if err != nil {
		slog.Error("创建分组失败", "error", err)
		response.InternalError(c, "创建失败")
		return
	}

	response.Success(c, toGroupResp(g))
}

// UpdateGroup 更新分组
func (h *GroupHandler) UpdateGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的分组 ID")
		return
	}

	var req dto.UpdateGroupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BindError(c, err)
		return
	}

	builder := h.db.Group.UpdateOneID(id)

	if req.Name != nil {
		builder = builder.SetName(*req.Name)
	}
	if req.RateMultiplier != nil {
		builder = builder.SetRateMultiplier(*req.RateMultiplier)
	}
	if req.IsExclusive != nil {
		builder = builder.SetIsExclusive(*req.IsExclusive)
	}
	if req.SubscriptionType != nil {
		builder = builder.SetSubscriptionType(group.SubscriptionType(*req.SubscriptionType))
	}
	if req.Quotas != nil {
		builder = builder.SetQuotas(req.Quotas)
	}
	if req.ModelRouting != nil {
		builder = builder.SetModelRouting(req.ModelRouting)
	}
	if req.ServiceTier != nil {
		builder = builder.SetServiceTier(*req.ServiceTier)
	}
	if req.SortWeight != nil {
		builder = builder.SetSortWeight(*req.SortWeight)
	}

	g, err := builder.Save(c.Request.Context())
	if err != nil {
		if ent.IsNotFound(err) {
			response.NotFound(c, "分组不存在")
			return
		}
		slog.Error("更新分组失败", "error", err)
		response.InternalError(c, "更新失败")
		return
	}

	response.Success(c, toGroupResp(g))
}

// DeleteGroup 删除分组
func (h *GroupHandler) DeleteGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的分组 ID")
		return
	}

	tx, err := h.db.Tx(c.Request.Context())
	if err != nil {
		slog.Error("开启删除分组事务失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err = tx.Group.Get(c.Request.Context(), id); err != nil {
		if ent.IsNotFound(err) {
			response.NotFound(c, "分组不存在")
			return
		}
		slog.Error("查询分组失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}

	hasSubscription, err := tx.UserSubscription.Query().
		Where(usersubscription.HasGroupWith(group.IDEQ(id))).
		Exist(c.Request.Context())
	if err != nil {
		slog.Error("检查分组订阅失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}
	if hasSubscription {
		response.BadRequest(c, "该分组仍存在用户订阅，请先取消或迁移订阅后再删除")
		return
	}

	if _, err = tx.APIKey.Update().
		Where(apikey.HasGroupWith(group.IDEQ(id))).
		ClearGroup().
		Save(c.Request.Context()); err != nil {
		slog.Error("解绑分组关联 API Key 失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}

	if _, err = tx.UsageLog.Update().
		Where(usagelog.HasGroupWith(group.IDEQ(id))).
		ClearGroup().
		Save(c.Request.Context()); err != nil {
		slog.Error("解绑分组关联使用记录失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}

	if err = tx.Group.DeleteOneID(id).Exec(c.Request.Context()); err != nil {
		if ent.IsNotFound(err) {
			response.NotFound(c, "分组不存在")
			return
		}
		if ent.IsConstraintError(err) {
			response.BadRequest(c, "该分组仍存在用户订阅，请先取消或迁移订阅后再删除")
			return
		}
		slog.Error("删除分组失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}

	if err = tx.Commit(); err != nil {
		slog.Error("提交删除分组事务失败", "error", err)
		response.InternalError(c, "删除失败")
		return
	}

	response.Success(c, nil)
}

// toGroupResp 将 ent.Group 转换为 dto.GroupResp
func toGroupResp(g *ent.Group) dto.GroupResp {
	return dto.GroupResp{
		ID:               int64(g.ID),
		Name:             g.Name,
		Platform:         g.Platform,
		RateMultiplier:   g.RateMultiplier,
		IsExclusive:      g.IsExclusive,
		SubscriptionType: string(g.SubscriptionType),
		Quotas:           g.Quotas,
		ModelRouting:     g.ModelRouting,
		ServiceTier:      g.ServiceTier,
		SortWeight:       g.SortWeight,
		TimeMixin: dto.TimeMixin{
			CreatedAt: g.CreatedAt,
			UpdatedAt: g.UpdatedAt,
		},
	}
}
