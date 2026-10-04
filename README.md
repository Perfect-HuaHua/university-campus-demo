# 某大学教学楼片区数字校园 Demo

第一版浏览器原型包含按用户提供的手绘校园图调整的全校区示意、9 栋可选教学建筑、周边道路与住宅、两处运动场、草地、樱花与常绿树、循环行驶的小汽车和步道行人。图面按北向上解读；所有模型尺度、建筑名称、楼层和坐标均为演示估算，不代表学校核实档案，也未接入地理地图。

## 运行

在此目录打开终端运行：

```powershell
npm.cmd run dev
```

浏览器访问 <http://127.0.0.1:5180/>。生产构建运行 `npm.cmd run build`；模型、建筑数据及总体积校验运行 `npm.cmd run verify`。

## 操作

- 拖动画布旋转，滚轮缩放；点击建筑、标签或楼栋列表可以选择楼栋。
- 选择楼栋后可查看演示属性、轮廓高亮及平滑定位；未知实测数据均有提示。
- 底部按钮可恢复总览、切换相机环绕、隐藏楼栋标签和进入全屏。
- 手机端从顶栏打开楼栋列表，选择后显示信息面板；关闭面板可扩大场景视野。
- 外围环路连通东门、西门和楼群内环路，另有南北连接线；汽车沿道路循环行驶，行人在中轴步道与教学楼前步道往返行走。草地采用真实颜色、法线和粗糙度贴图，路面与草地分层显示。

## 模型文件

- `blender/build_campus.py`：可重复运行的 Blender 建模与 GLB 导出脚本。
- `public/models/university-campus-demo.blend`：可继续编辑的 Blender 场景。
- `public/models/university-campus-demo.glb`：Three.js 使用的网页模型，含楼栋 `buildingId`。
- `public/data/buildings.json`：网页楼栋信息及模型编号映射。
- `renders/campus-overview.png`：Blender 总览渲染；`renders/demo-desktop.png`、`renders/demo-mobile.png`：浏览器画面检查。
- `docs/reference-notes.md`、`docs/assets.md`：参考依据与素材来源。

重新生成模型：

```powershell
& 'D:\blender\blender.exe' --background --python 'D:\AI工具Codex项目\建模\campus-demo\blender\build_campus.py'
```

场景采用米制坐标；学校照片仅用于观察立面特征。草地表面使用 Poly Haven 的 CC0 纹理；树木、车辆和行人网格为本项目程序生成。道路交通与行走动画在网页端运行，Blender 工程保存静态环境模型。
