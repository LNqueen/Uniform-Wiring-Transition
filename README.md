# 均匀线宽过渡 (Uniform Wiring Transition)

一个用于嘉立创EDA (EasyEDA Pro) 的插件，用于在不同宽度的导线之间创建平滑的阶梯式过渡。

## 主要功能

- **阶梯过渡**: 自动在两根宽度不同的导线之间生成多段线宽渐变的导线段。
- **双导线连接**: 选中两根导线，插件会自动识别最近的端点进行连接。
- **单位切换**: 支持 mm 和 mil 两种单位显示。
- **自定义段数**: 用户可以指定阶梯的段数 (1-50)，以控制过渡的平滑程度。

## 使用方法

1. **安装插件**: 加载本插件 (`.eext` 文件)。
2. **选择导线**: 在 PCB 编辑器中，选中 **两根** 需要连接的导线 (Track)。
3. **运行命令**: 点击顶部菜单 **均匀过渡** -> **创建阶梯过渡**。
4. **设置参数**:
    - 插件会自动计算两根导线最近端点的距离。
    - 在弹出的对话框中，输入想要的 **阶梯段数** (建议参考显示的建议值)。
5. **完成**: 插件将自动生成连接导线。

## 菜单选项

- **创建阶梯过渡**: 执行主要的过渡生成功能。
- **切换单位 (mm/mil)**: 在毫米和密耳之间切换插件显示的单位。
- **关于**: 显示插件版本和当前设置信息。

## 注意事项

- 必须选中且仅选中 **两条** 导线。
- 两条导线必须在 **同一图层**。
- 两条导线不能距离过远 (>100mm) 或已经相连。

## 效果图

![](./images/img1.png)

---

# Uniform Wiring Transition

A plugin for EasyEDA Pro to create smooth stepped transitions between tracks of different widths.

## Features

- **Stepped Transition**: Automatically generates multiple segments with incremental width changes between two tracks.
- **Two-Track Connection**: Select two tracks, and the plugin automatically identifies the closest endpoints to connect.
- **Unit Switching**: Supports display in both mm and mil.
- **Custom Segment Count**: Users can specify the number of stepped segments (1-50) to control smoothness.

## Usage

1. **Install Plugin**: Load this plugin (`.eext` file).
2. **Select Tracks**: In the PCB editor, select **two** tracks that you want to connect.
3. **Run Command**: Click top menu **Uniform Transition** -> **Create Stepped Transition**.
4. **Configure**:
    - The plugin automatically calculates the distance between the closest endpoints.
    - In the popup dialog, enter the desired **Segment Count** (refer to the suggested value).
5. **Done**: The plugin will generate the connecting tracks.

## Menu Options

- **Create Stepped Transition**: Execute the main transition function.
- **Toggle Unit (mm/mil)**: Switch display units between millimeters and mils.
- **About**: Show plugin version and current settings.

## Notes

- You must select exactly **two** tracks.
- Both tracks must be on the **same layer**.
- Tracks cannot be too far apart (>100mm) or already connected.

## Rendering

![](./images/img1.png)
