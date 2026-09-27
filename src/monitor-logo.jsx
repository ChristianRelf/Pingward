import React from "react";
import {
  Activity,
  Cloud,
  Code2,
  Database,
  Globe2,
  HardDrive,
  Mail,
  Server,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { DEFAULT_MONITOR_LOGO } from "../shared/monitor-logos.js";

const presetIcons = {
  activity: Activity,
  globe: Globe2,
  server: Server,
  database: Database,
  cloud: Cloud,
  shield: ShieldCheck,
  wifi: Wifi,
  mail: Mail,
  code: Code2,
  drive: HardDrive,
};

export function MonitorLogo({ monitor, size = 20, preview = "" }) {
  if (preview || (monitor?.has_logo && monitor.id))
    return (
      <img
        className="monitor-logo-image"
        src={
          preview ||
          `/api/monitor-logos/${monitor.id}?v=${monitor.logo_updated_at || 0}`
        }
        width={size}
        height={size}
        alt=""
      />
    );
  const Icon =
    presetIcons[monitor?.logo_preset] || presetIcons[DEFAULT_MONITOR_LOGO];
  return <Icon size={size} aria-hidden="true" />;
}
