import { createElement, useState, useEffect } from 'react';
import { Server } from 'lucide-react';
import { getPluginPlatformIcon, onPlatformIconChange } from '../../app/plugin-loader';

interface PlatformIconProps {
  platform: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PlatformIcon({ platform, className = 'w-3.5 h-3.5', style }: PlatformIconProps) {
  // 订阅图标注册变更以触发重渲染
  const [, setVer] = useState(0);
  useEffect(() => onPlatformIconChange(() => setVer((v) => v + 1)), []);

  const PluginIcon = getPluginPlatformIcon(platform);
  if (PluginIcon) return createElement(PluginIcon, { className, style });
  return <Server className={className} style={style} />;
}
