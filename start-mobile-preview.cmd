@echo off
setlocal
cd /d "%~dp0"
echo Connect your phone and this computer to the same Wi-Fi.
echo Open the Phone URL printed below on your phone.
echo Keep this window open while testing. Press Ctrl+C to stop.
node serve.mjs --host 0.0.0.0
pause
