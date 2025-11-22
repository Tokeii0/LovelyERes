// LovelyRes 主题管理器

use crate::settings::{load_settings, save_settings};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 主题配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeConfig {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub icon: String,
    pub colors: HashMap<String, String>,
    pub is_dark: bool,
}

/// 主题管理器
pub struct ThemeManager;

impl ThemeManager {
    /// 获取所有可用主题
    pub fn get_available_themes() -> Vec<ThemeConfig> {
        vec![
            ThemeConfig {
                name: "light".to_string(),
                display_name: "浅色".to_string(),
                description: "清新明亮的浅色主题".to_string(),
                icon: "☀️".to_string(),
                colors: Self::get_light_theme_colors(),
                is_dark: false,
            },
            ThemeConfig {
                name: "dark".to_string(),
                display_name: "深色".to_string(),
                description: "护眼舒适的深色主题".to_string(),
                icon: "🌙".to_string(),
                colors: Self::get_dark_theme_colors(),
                is_dark: true,
            },
            ThemeConfig {
                name: "sakura".to_string(),
                display_name: "樱花粉".to_string(),
                description: "温柔浪漫的樱花主题".to_string(),
                icon: "🌸".to_string(),
                colors: Self::get_sakura_theme_colors(),
                is_dark: false,
            },
        ]
    }

    /// 获取浅色主题颜色
    fn get_light_theme_colors() -> HashMap<String, String> {
        let mut colors = HashMap::new();
        colors.insert("primary-color".to_string(), "#4299e1".to_string());
        colors.insert("secondary-color".to_string(), "#63b3ed".to_string());
        colors.insert("accent-color".to_string(), "#81e6d9".to_string());
        colors.insert("success-color".to_string(), "#48bb78".to_string());
        colors.insert("warning-color".to_string(), "#ed8936".to_string());
        colors.insert("error-color".to_string(), "#f56565".to_string());
        colors.insert("info-color".to_string(), "#4299e1".to_string());

        colors.insert("bg-primary".to_string(), "#f8fafc".to_string());
        colors.insert("bg-secondary".to_string(), "#ffffff".to_string());
        colors.insert("bg-tertiary".to_string(), "#f1f5f9".to_string());
        colors.insert("bg-dark".to_string(), "#1e293b".to_string());
        colors.insert(
            "bg-glass".to_string(),
            "rgba(255, 255, 255, 0.1)".to_string(),
        );

        colors.insert("text-primary".to_string(), "#1e293b".to_string());
        colors.insert("text-secondary".to_string(), "#64748b".to_string());
        colors.insert("text-light".to_string(), "#94a3b8".to_string());
        colors.insert("text-white".to_string(), "#ffffff".to_string());

        colors
    }

    /// 获取深色主题颜色
    fn get_dark_theme_colors() -> HashMap<String, String> {
        let mut colors = HashMap::new();
        colors.insert("primary-color".to_string(), "#4299e1".to_string());
        colors.insert("secondary-color".to_string(), "#63b3ed".to_string());
        colors.insert("accent-color".to_string(), "#81e6d9".to_string());
        colors.insert("success-color".to_string(), "#48bb78".to_string());
        colors.insert("warning-color".to_string(), "#ed8936".to_string());
        colors.insert("error-color".to_string(), "#f56565".to_string());
        colors.insert("info-color".to_string(), "#4299e1".to_string());

        colors.insert("bg-primary".to_string(), "#0f172a".to_string());
        colors.insert("bg-secondary".to_string(), "#1e293b".to_string());
        colors.insert("bg-tertiary".to_string(), "#334155".to_string());
        colors.insert("bg-dark".to_string(), "#475569".to_string());
        colors.insert("bg-glass".to_string(), "rgba(0, 0, 0, 0.3)".to_string());

        colors.insert("text-primary".to_string(), "#f1f5f9".to_string());
        colors.insert("text-secondary".to_string(), "#cbd5e1".to_string());
        colors.insert("text-light".to_string(), "#94a3b8".to_string());
        colors.insert("text-white".to_string(), "#ffffff".to_string());

        colors
    }

    /// 获取樱花主题颜色
    fn get_sakura_theme_colors() -> HashMap<String, String> {
        let mut colors = HashMap::new();
        colors.insert("primary-color".to_string(), "#ff9bb3".to_string());
        colors.insert("secondary-color".to_string(), "#ffb3c1".to_string());
        colors.insert("accent-color".to_string(), "#ffc0cb".to_string());
        colors.insert("success-color".to_string(), "#f8bbd9".to_string());
        colors.insert("warning-color".to_string(), "#ffc1cc".to_string());
        colors.insert("error-color".to_string(), "#ffb3ba".to_string());
        colors.insert("info-color".to_string(), "#ff9eb5".to_string());

        colors.insert("bg-primary".to_string(), "#fef9f9".to_string());
        colors.insert("bg-secondary".to_string(), "#fffefe".to_string());
        colors.insert("bg-tertiary".to_string(), "#fef5f7".to_string());
        colors.insert("bg-dark".to_string(), "#c53030".to_string());
        colors.insert(
            "bg-glass".to_string(),
            "rgba(255, 192, 203, 0.12)".to_string(),
        );

        colors.insert("text-primary".to_string(), "#744c4c".to_string());
        colors.insert("text-secondary".to_string(), "#a0616d".to_string());
        colors.insert("text-light".to_string(), "#d69e9e".to_string());
        colors.insert("text-white".to_string(), "#ffffff".to_string());

        colors
    }

    /// 获取主题配置
    pub fn get_theme_config(theme_name: &str) -> Option<ThemeConfig> {
        Self::get_available_themes()
            .into_iter()
            .find(|theme| theme.name == theme_name)
    }

    /// 获取当前主题
    pub fn get_current_theme() -> Result<String, String> {
        let settings = load_settings()?;
        Ok(settings.theme)
    }

    /// 设置当前主题
    pub fn set_current_theme(theme_name: String) -> Result<(), String> {
        // 验证主题是否存在
        if Self::get_theme_config(&theme_name).is_none() {
            return Err(format!("主题不存在: {}", theme_name));
        }

        let mut settings = load_settings()?;
        settings.theme = theme_name.clone();
        save_settings(&settings)?;

        println!("🎨 主题已设置为: {}", theme_name);
        Ok(())
    }

    /// 切换到下一个主题
    pub fn toggle_theme() -> Result<String, String> {
        let current_theme = Self::get_current_theme()?;
        let themes = Self::get_available_themes();

        let current_index = themes
            .iter()
            .position(|theme| theme.name == current_theme)
            .unwrap_or(0);

        let next_index = (current_index + 1) % themes.len();
        let next_theme = &themes[next_index];

        Self::set_current_theme(next_theme.name.clone())?;
        Ok(next_theme.name.clone())
    }

    /// 获取主题预览数据
    pub fn get_theme_preview(theme_name: &str) -> Result<serde_json::Value, String> {
        let theme_config = Self::get_theme_config(theme_name)
            .ok_or_else(|| format!("主题不存在: {}", theme_name))?;

        Ok(serde_json::json!({
            "name": theme_config.name,
            "display_name": theme_config.display_name,
            "description": theme_config.description,
            "icon": theme_config.icon,
            "is_dark": theme_config.is_dark,
            "colors": theme_config.colors,
            "preview": {
                "primary": theme_config.colors.get("primary-color").unwrap_or(&"#4299e1".to_string()),
                "background": theme_config.colors.get("bg-primary").unwrap_or(&"#ffffff".to_string()),
                "text": theme_config.colors.get("text-primary").unwrap_or(&"#000000".to_string()),
                "accent": theme_config.colors.get("accent-color").unwrap_or(&"#81e6d9".to_string())
            }
        }))
    }

    /// 获取所有主题预览
    pub fn get_all_theme_previews() -> Vec<serde_json::Value> {
        Self::get_available_themes()
            .iter()
            .map(|theme| Self::get_theme_preview(&theme.name).unwrap_or_default())
            .collect()
    }

    /// 验证主题配置
    pub fn validate_theme_config(config: &ThemeConfig) -> Result<(), String> {
        // 验证主题名称
        if config.name.is_empty() {
            return Err("主题名称不能为空".to_string());
        }

        // 验证显示名称
        if config.display_name.is_empty() {
            return Err("主题显示名称不能为空".to_string());
        }

        // 验证必需的颜色
        let required_colors = vec![
            "primary-color",
            "bg-primary",
            "bg-secondary",
            "text-primary",
            "text-secondary",
        ];

        for color_key in required_colors {
            if !config.colors.contains_key(color_key) {
                return Err(format!("缺少必需的颜色配置: {}", color_key));
            }
        }

        // 验证颜色格式（简单验证）
        for (key, value) in &config.colors {
            if !value.starts_with('#') && !value.starts_with("rgb") && !value.starts_with("rgba") {
                return Err(format!("无效的颜色格式: {} = {}", key, value));
            }
        }

        Ok(())
    }

    /// 创建自定义主题
    pub fn create_custom_theme(
        name: String,
        display_name: String,
        description: String,
        icon: String,
        colors: HashMap<String, String>,
        is_dark: bool,
    ) -> Result<ThemeConfig, String> {
        let theme_config = ThemeConfig {
            name: name.clone(),
            display_name,
            description,
            icon,
            colors,
            is_dark,
        };

        // 验证主题配置
        Self::validate_theme_config(&theme_config)?;

        // 这里可以保存自定义主题到文件
        // save_custom_theme(&theme_config)?;

        println!("✅ 自定义主题已创建: {}", name);
        Ok(theme_config)
    }

    /// 导出主题配置
    pub fn export_theme_config(theme_name: &str) -> Result<String, String> {
        let theme_config = Self::get_theme_config(theme_name)
            .ok_or_else(|| format!("主题不存在: {}", theme_name))?;

        serde_json::to_string_pretty(&theme_config).map_err(|e| format!("导出主题配置失败: {}", e))
    }

    /// 导入主题配置
    pub fn import_theme_config(config_json: &str) -> Result<ThemeConfig, String> {
        let theme_config: ThemeConfig =
            serde_json::from_str(config_json).map_err(|e| format!("解析主题配置失败: {}", e))?;

        // 验证主题配置
        Self::validate_theme_config(&theme_config)?;

        println!("✅ 主题配置已导入: {}", theme_config.name);
        Ok(theme_config)
    }

    /// 获取主题统计信息
    pub fn get_theme_stats() -> serde_json::Value {
        let themes = Self::get_available_themes();
        let current_theme = Self::get_current_theme().unwrap_or_default();

        let light_themes = themes.iter().filter(|t| !t.is_dark).count();
        let dark_themes = themes.iter().filter(|t| t.is_dark).count();

        serde_json::json!({
            "total_themes": themes.len(),
            "light_themes": light_themes,
            "dark_themes": dark_themes,
            "current_theme": current_theme,
            "available_themes": themes.iter().map(|t| &t.name).collect::<Vec<_>>()
        })
    }

    /// 重置主题到默认
    pub fn reset_to_default_theme() -> Result<(), String> {
        Self::set_current_theme("light".to_string())
    }

    /// 检查主题是否为深色主题
    pub fn is_dark_theme(theme_name: &str) -> bool {
        Self::get_theme_config(theme_name)
            .map(|config| config.is_dark)
            .unwrap_or(false)
    }

    /// 获取主题的对比色
    pub fn get_contrast_color(theme_name: &str, color_key: &str) -> Option<String> {
        let theme_config = Self::get_theme_config(theme_name)?;
        let color = theme_config.colors.get(color_key)?;

        // 简单的对比色计算（这里可以实现更复杂的算法）
        if theme_config.is_dark {
            Some("#ffffff".to_string())
        } else {
            Some("#000000".to_string())
        }
    }
}
