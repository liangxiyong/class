@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 生成 ESC 字符用于 ANSI 颜色
for /f "delims=#" %%E in ('"prompt #$E# & for %%E in (1) do rem"') do set "ESC=%%E"

:: 颜色定义
set "RED=%ESC%[91m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[94m"
set "MAGENTA=%ESC%[95m"
set "CYAN=%ESC%[96m"
set "WHITE=%ESC%[97m"
set "GRAY=%ESC%[90m"
set "BOLD=%ESC%[1m"
set "RESET=%ESC%[0m"

:: 项目路径
set "PROJECT_DIR=%~dp0"
set "WORKER_DIR=%~dp0proxy-site"

:MENU
cls
echo.
echo  %BOLD%%CYAN%╔══════════════════════════════════════════════╗%RESET%
echo  %BOLD%%CYAN%║%RESET%         %BOLD%%WHITE%班级小组积分系统 - 部署工具%RESET%          %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%╠══════════════════════════════════════════════╣%RESET%
echo  %BOLD%%CYAN%║%RESET%                                              %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%║%RESET%   %GREEN%[1]%RESET%  部署网站页面 (class Pages)            %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%║%RESET%   %GREEN%[2]%RESET%  部署代理 Worker (jfz-proxy-api)     %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%║%RESET%   %GREEN%[3]%RESET%  全部部署 (页面 + Worker)             %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%║%RESET%                                              %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%║%RESET%   %RED%[0]%RESET%  退出                                 %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%║%RESET%                                              %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%╠══════════════════════════════════════════════╣%RESET%
echo  %BOLD%%CYAN%║%RESET%   %WHITE%请输入选项编号:%RESET%                           %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%╚══════════════════════════════════════════════╝%RESET%
echo.
set /p "choice=  > "

if "%choice%"=="1" goto DEPLOY_CLASS
if "%choice%"=="2" goto DEPLOY_WORKER
if "%choice%"=="3" goto DEPLOY_ALL
if "%choice%"=="0" goto EXIT
echo.
echo  %RED%  ❌ 无效选择，请输入 0-3 之间的数字！%RESET%
timeout /t 2 >nul
goto MENU

:CHECK_ENV
echo  %YELLOW%  🔍 检查运行环境...%RESET%
where wrangler >nul 2>&1
if %errorlevel% neq 0 (
    echo  %RED%  ❌ 未找到 wrangler 命令%RESET%
    echo  %WHITE%  请先安装 Node.js，然后执行: npm install -g wrangler%RESET%
    echo.
    pause
    goto MENU
)
echo  %GREEN%  ✅ wrangler 已就绪%RESET%
goto :eof

:DEPLOY_CLASS
cls
echo.
echo  %BOLD%%BLUE%╔══════════════════════════════════════════════╗%RESET%
echo  %BOLD%%BLUE%║%RESET%               %BOLD%%WHITE%部署网站页面%RESET%                     %BOLD%%BLUE%║%RESET%
echo  %BOLD%%BLUE%╚══════════════════════════════════════════════╝%RESET%
echo.
call :CHECK_ENV
echo.
echo  %WHITE%  📁 项目目录: %PROJECT_DIR%%RESET%
echo  %WHITE%  🎯 项目名称: class%RESET%
echo.
echo  %YELLOW%  ──────────────────────────────────────────────%RESET%
cd /d "%PROJECT_DIR%"
call wrangler pages deploy . --project-name=class
echo  %YELLOW%  ──────────────────────────────────────────────%RESET%
if %errorlevel% equ 0 (
    echo.
    echo  %GREEN%  ✅ 网站页面部署成功！%RESET%
    echo  %WHITE%  🌐 访问地址: https://class-amv.pages.dev%RESET%
) else (
    echo.
    echo  %RED%  ❌ 部署失败，请查看上方错误信息%RESET%
)
echo.
echo  %GRAY%  按任意键返回菜单...%RESET%
pause >nul
goto MENU

:DEPLOY_WORKER
cls
echo.
echo  %BOLD%%BLUE%╔══════════════════════════════════════════════╗%RESET%
echo  %BOLD%%BLUE%║%RESET%              %BOLD%%WHITE%部署代理 Worker%RESET%                    %BOLD%%BLUE%║%RESET%
echo  %BOLD%%BLUE%╚══════════════════════════════════════════════╝%RESET%
echo.
call :CHECK_ENV
if not exist "%WORKER_DIR%" (
    echo.
    echo  %RED%  ❌ 未找到 proxy-site 目录%RESET%
    echo  %WHITE%  期望路径: %WORKER_DIR%%RESET%
    echo.
    pause
    goto MENU
)
echo.
echo  %WHITE%  📁 Worker目录: %WORKER_DIR%%RESET%
echo  %WHITE%  🎯 项目名称: jfz-proxy-api%RESET%
echo.
echo  %YELLOW%  ──────────────────────────────────────────────%RESET%
cd /d "%WORKER_DIR%"
call wrangler pages deploy . --project-name=jfz-proxy-api
echo  %YELLOW%  ──────────────────────────────────────────────%RESET%
cd /d "%PROJECT_DIR%"
if %errorlevel% equ 0 (
    echo.
    echo  %GREEN%  ✅ 代理 Worker 部署成功！%RESET%
    echo  %WHITE%  🌐 代理地址: https://jfz-proxy-api.pages.dev%RESET%
) else (
    echo.
    echo  %RED%  ❌ 部署失败，请查看上方错误信息%RESET%
)
echo.
echo  %GRAY%  按任意键返回菜单...%RESET%
pause >nul
goto MENU

:DEPLOY_ALL
cls
echo.
echo  %BOLD%%MAGENTA%╔══════════════════════════════════════════════╗%RESET%
echo  %BOLD%%MAGENTA%║%RESET%                  %BOLD%%WHITE%全部部署%RESET%                        %BOLD%%MAGENTA%║%RESET%
echo  %BOLD%%MAGENTA%╚══════════════════════════════════════════════╝%RESET%
echo.
call :CHECK_ENV
echo.
echo  %WHITE%  将依次部署以下项目：%RESET%
echo  %WHITE%    ① 网站页面 (class Pages)%RESET%
echo  %WHITE%    ② 代理 Worker (jfz-proxy-api)%RESET%
echo.

echo  %BOLD%%BLUE%  ┌─ ① 部署网站页面 ───────────────────────────%RESET%
cd /d "%PROJECT_DIR%"
call wrangler pages deploy . --project-name=class
if %errorlevel% neq 0 (
    echo.
    echo  %RED%  ❌ 网站页面部署失败，已中止后续部署%RESET%
    echo.
    pause
    goto MENU
)
echo  %GREEN%  ✅ 网站页面部署成功%RESET%
echo.

echo  %BOLD%%BLUE%  ┌─ ② 部署代理 Worker ────────────────────────%RESET%
cd /d "%WORKER_DIR%"
call wrangler pages deploy . --project-name=jfz-proxy-api
cd /d "%PROJECT_DIR%"
if %errorlevel% neq 0 (
    echo.
    echo  %RED%  ❌ 代理 Worker 部署失败%RESET%
    echo.
    pause
    goto MENU
)
echo  %GREEN%  ✅ 代理 Worker 部署成功%RESET%
echo.
echo  %BOLD%%GREEN%  ╔══════════════════════════════════════════╗%RESET%
echo  %BOLD%%GREEN%  ║%RESET%          %BOLD%%WHITE%🎉 全部部署完成！%RESET%               %BOLD%%GREEN%║%RESET%
echo  %BOLD%%GREEN%  ╠══════════════════════════════════════════╣%RESET%
echo  %BOLD%%GREEN%  ║%RESET%  🌐 网站: https://class-amv.pages.dev      %BOLD%%GREEN%║%RESET%
echo  %BOLD%%GREEN%  ║%RESET%  🔄 代理: https://jfz-proxy-api.pages.dev  %BOLD%%GREEN%║%RESET%
echo  %BOLD%%GREEN%  ╚══════════════════════════════════════════╝%RESET%
echo.
echo  %GRAY%  按任意键返回菜单...%RESET%
pause >nul
goto MENU

:EXIT
cls
echo.
echo  %BOLD%%CYAN%  ╔══════════════════════════════════════════════╗%RESET%
echo  %BOLD%%CYAN%  ║%RESET%                %BOLD%%WHITE%感谢使用，再见！%RESET%                   %BOLD%%CYAN%║%RESET%
echo  %BOLD%%CYAN%  ╚══════════════════════════════════════════════╝%RESET%
echo.
timeout /t 1 >nul
exit
