@echo off
setlocal

set GRADLE_VERSION=8.12
set GRADLE_INSTALL_DIR=%USERPROFILE%\.gradle\wrapper\dists\gradle-%GRADLE_VERSION%-bin
set GRADLE_CMD=%GRADLE_INSTALL_DIR%\bin\gradle.bat

if not exist "%GRADLE_CMD%" (
  echo [gradlew] Gradle %GRADLE_VERSION% not found -- downloading...
  if not exist "%GRADLE_INSTALL_DIR%" mkdir "%GRADLE_INSTALL_DIR%"
  set GRADLE_URL=https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip
  powershell -Command "Invoke-WebRequest -Uri '%GRADLE_URL%' -OutFile '%TEMP%\gradle.zip'"
  powershell -Command "Expand-Archive -Path '%TEMP%\gradle.zip' -DestinationPath '%TEMP%\gradle_extract' -Force"
  xcopy /e /i /q "%TEMP%\gradle_extract\gradle-%GRADLE_VERSION%\*" "%GRADLE_INSTALL_DIR%\"
  rmdir /s /q "%TEMP%\gradle_extract"
  del "%TEMP%\gradle.zip"
  echo [gradlew] Gradle %GRADLE_VERSION% installed.
)

"%GRADLE_CMD%" %*
