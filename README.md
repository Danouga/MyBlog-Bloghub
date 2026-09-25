# Bloghub

无登录、无网页仓库写入功能的静态博客与代码笔记空间。

## 手动发布
将 Markdown 或代码文件上传到 GitHub 仓库 notes/ 目录，提交至 main 分支后自动部署。支持子目录，如 notes/学习/Python/example.py。
网页编辑、导入、新建和 Ctrl+S 仅保存浏览器草稿，不上传到仓库。点击下载后，由你手动上传 GitHub。文件夹和左侧收起状态保存在浏览器；清理浏览器会丢失草稿，请及时下载备份。

## 浏览器 Python
打开 .py 文件直接运行，无需服务、venv、凭据或连接密钥。固定版本 Pyodide 0.27.3 在独立 Worker 中执行，首次联网从 jsDelivr 下载运行时及受支持依赖。支持预填 input()、输出、报错、停止，运行上限 30 秒，加载上限 120 秒。每次运行使用独立环境，输出最多 200000 字符。不使用本机 Python 包。

## 可选本地预览
运行 python runner.py 后打开 http://127.0.0.1:8765 。该服务仅提供页面，不执行本机代码、不读取 GitHub 凭据、不接受提交请求、不生成密钥。在线网站不依赖本地服务。

## 验证
python -m unittest discover -s tests -v

node --check app.js
