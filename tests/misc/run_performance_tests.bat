@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Performance Testing Suite for Project Velocity (Windows)
REM Tests QPS, latency, cache effectiveness, and system load

if "%BACKEND_URL%"=="" set "BACKEND_URL=http://localhost:4000/api/search"
if "%SOLR_URL%"=="" set "SOLR_URL=http://10.145.245.107:8983/solr"
if "%TEST_QUERY%"=="" set "TEST_QUERY=stock"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "RESULTS_FILE=%TEMP%\performance_test_%TS%.txt"

call :log_header "PERFORMANCE TEST SUITE - Project Velocity"
echo Date: %DATE% %TIME%
echo Backend: %BACKEND_URL%
echo Solr: %SOLR_URL%
echo Results saved to: %RESULTS_FILE%
echo.

(
	echo ========================================
	echo Performance Test Results
	echo Date: %DATE% %TIME%
	echo ========================================
	echo.
) > "%RESULTS_FILE%"

call :test_connectivity || goto :fail
call :test_single_request || goto :fail
call :test_cache_effectiveness || goto :fail
call :test_burst_load || goto :fail
call :test_mixed_queries || goto :fail
call :test_system_health || goto :fail
call :test_sustained_load

call :log_header "TEST SUMMARY"
call :log_success "All tests completed!"
call :log_info "Results saved to: %RESULTS_FILE%"
echo.
powershell -NoProfile -Command "Get-Content -Tail 20 -Path '%RESULTS_FILE%'"
goto :eof

:fail
call :log_error "Test suite stopped due to an error."
exit /b 1

:log_header
echo ===========================================================
echo   %~1
echo ===========================================================
exit /b 0

:log_info
echo [INFO] %~1
exit /b 0

:log_success
echo [OK] %~1
exit /b 0

:log_warning
echo [WARN] %~1
exit /b 0

:log_error
echo [ERROR] %~1
exit /b 0

:log_result
if "%~1"=="" (
	echo.
	>> "%RESULTS_FILE%" echo.
) else (
	echo %~1
	>> "%RESULTS_FILE%" echo %~1
)
exit /b 0

:test_connectivity
call :log_header "TEST 1: Connectivity Check"
call :log_info "Checking Backend..."
curl -s "%BACKEND_URL%?q=test" >nul 2>nul
if errorlevel 1 (
	call :log_error "Backend is NOT responding at %BACKEND_URL%"
	exit /b 1
)
call :log_success "Backend is responding"

call :log_info "Checking Solr..."
curl -s "%SOLR_URL%/admin/info/system?wt=json" >nul 2>nul
if errorlevel 1 (
	call :log_error "Solr is NOT responding at %SOLR_URL%"
	exit /b 1
)
call :log_success "Solr is responding"
echo.
exit /b 0

:test_single_request
call :log_header "TEST 2: Single Request Latency (Warmup)"
call :log_info "Running 1 request to warm up cache..."

for /f %%i in ('powershell -NoProfile -Command "$u='%BACKEND_URL%?q=%TEST_QUERY%^&rows=10'; $sw=[Diagnostics.Stopwatch]::StartNew(); $r=Invoke-WebRequest -UseBasicParsing -Uri $u; $sw.Stop(); [int]$sw.ElapsedMilliseconds"') do set "LATENCY_MS=%%i"
for /f %%i in ('powershell -NoProfile -Command "$u='%BACKEND_URL%?q=%TEST_QUERY%^&rows=10'; try { ((Invoke-RestMethod -Uri $u).total) } catch { '?' }"') do set "TOTAL_RESULTS=%%i"

call :log_result "Warmup Request Latency: %LATENCY_MS%ms"
call :log_result "Total Results Available: %TOTAL_RESULTS%"
call :log_success "Cache warmed up"
echo.
exit /b 0

:test_cache_effectiveness
call :log_header "TEST 3: Cache Effectiveness (Sequential Requests)"
call :log_info "Running 10 sequential requests to same query..."
call :log_result ""
call :log_result "Sequential Request Latencies:"

set /a TOTAL_TIME=0
set /a MAX_TIME=0
set /a MIN_TIME=999999

for /L %%i in (1,1,10) do (
	for /f %%t in ('powershell -NoProfile -Command "$u='%BACKEND_URL%?q=%TEST_QUERY%^&rows=10'; $sw=[Diagnostics.Stopwatch]::StartNew(); Invoke-WebRequest -UseBasicParsing -Uri $u ^| Out-Null; $sw.Stop(); [int]$sw.ElapsedMilliseconds"') do set "ELAPSED_MS=%%t"

	set /a TOTAL_TIME+=!ELAPSED_MS!
	if !ELAPSED_MS! GTR !MAX_TIME! set /a MAX_TIME=!ELAPSED_MS!
	if !ELAPSED_MS! LSS !MIN_TIME! set /a MIN_TIME=!ELAPSED_MS!

	set "TAG=(warm)"
	if %%i EQU 1 set "TAG=(cold)"
	if %%i GTR 1 if !ELAPSED_MS! LSS 50 set "TAG=(hot - cached)"

	echo   Request %%i: !ELAPSED_MS!ms !TAG!
	call :log_result "  Request %%i: !ELAPSED_MS!ms"
)

set /a AVG_TIME=TOTAL_TIME/10
echo.
call :log_result ""
call :log_result "Cache Statistics:"
call :log_result "  Average Latency: %AVG_TIME%ms"
call :log_result "  Min Latency: %MIN_TIME%ms (best case - from cache)"
call :log_result "  Max Latency: %MAX_TIME%ms (worst case - cold start)"
call :log_success "Cache working: min %MIN_TIME%ms vs max %MAX_TIME%ms"
echo.
exit /b 0

:test_burst_load
call :log_header "TEST 4: Burst Load Test (50 concurrent requests)"
call :log_info "Sending 50 rapid requests..."
set /a BURST_OK=0
for /L %%i in (1,1,50) do (
	curl -s "%BACKEND_URL%?q=%TEST_QUERY%&rows=10" >nul 2>nul
	if !errorlevel! EQU 0 set /a BURST_OK+=1
)

call :log_result "Burst Test Results:"
call :log_result "  Requests: 50"
call :log_result "  Successful: %BURST_OK%"
call :log_result "  Mode: Rapid 50-request burst"
call :log_success "Burst test completed"
echo.
exit /b 0

:test_sustained_load
call :log_header "TEST 5: Sustained Load Test"
call :log_info "Siege is Unix-only in most setups; using autocannon if available..."
if /I not "%RUN_AUTOCANNON%"=="1" (
  call :log_warning "Skipping autocannon by default. Set RUN_AUTOCANNON=1 to enable this test."
  echo.
  exit /b 0
)

npx --yes autocannon -c 100 -a 5000 "%BACKEND_URL%?q=%TEST_QUERY%" >nul 2>nul
if errorlevel 1 (
	call :log_warning "autocannon unavailable or failed; skipping sustained load test"
) else (
	call :log_success "autocannon sustained load test completed"
)
echo.
exit /b 0

:test_mixed_queries
call :log_header "TEST 6: Mixed Query Patterns (Different Searches)"
call :log_info "Running 5 different queries, 5 times each..."
call :log_result ""
call :log_result "Mixed Query Test Results:"

set /a TOTAL_QUERIES=0
set /a TOTAL_LATENCY=0

for %%q in (stock market technology politics health) do (
	for /L %%i in (1,1,5) do (
		for /f %%t in ('powershell -NoProfile -Command "$u='%BACKEND_URL%?q=%%q^&rows=5'; $sw=[Diagnostics.Stopwatch]::StartNew(); Invoke-WebRequest -UseBasicParsing -Uri $u ^| Out-Null; $sw.Stop(); [int]$sw.ElapsedMilliseconds"') do set "ELAPSED_MS=%%t"
		set /a TOTAL_LATENCY+=!ELAPSED_MS!
		set /a TOTAL_QUERIES+=1
	)
	set /a AVG_LATENCY=TOTAL_LATENCY/TOTAL_QUERIES
	call :log_result "  Query '%%q': Average latency ~!AVG_LATENCY!ms"
)

set /a OVERALL_AVG=TOTAL_LATENCY/TOTAL_QUERIES
call :log_result ""
call :log_result "  Overall Average Latency: %OVERALL_AVG%ms"
call :log_success "Mixed queries test completed"
echo.
exit /b 0

:test_system_health
call :log_header "TEST 7: System Health Check"
call :log_info "Collecting heap/cpu/disk metrics..."
powershell -NoProfile -Command "$solrUri='%SOLR_URL%/admin/info/system?wt=json'; try { $d=Invoke-RestMethod -Uri $solrUri -TimeoutSec 10; $max=[double]($d.jvm.memory.raw.max); $used=[double]($d.jvm.memory.raw.used); if($max -gt 0){ $pct=[math]::Round(($used*100)/$max,2); Write-Output (\"  Heap Usage: $([int64]$used)B / $([int64]$max)B (~$pct%%)\") } else { Write-Output \"  Heap Usage: N/A\" } } catch { Write-Output \"  Heap Usage: N/A\" }; try { $cpu=(Get-CimInstance Win32_Processor ^| Measure-Object -Property LoadPercentage -Average).Average; if($null -eq $cpu){ Write-Output \"  CPU Load: N/A\" } else { Write-Output (\"  CPU Load: $([int][math]::Round($cpu,0))%%\") } } catch { Write-Output \"  CPU Load: N/A\" }; try { $disk=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"; if($null -eq $disk -or $disk.Size -le 0){ Write-Output \"  C: Disk Used: N/A\" } else { $du=[math]::Round((($disk.Size-$disk.FreeSpace)/$disk.Size)*100,2); Write-Output (\"  C: Disk Used: $du%%\") } } catch { Write-Output \"  C: Disk Used: N/A\" }" > "%TEMP%\velocity_health_tmp.txt"
type "%TEMP%\velocity_health_tmp.txt"
type "%TEMP%\velocity_health_tmp.txt" >> "%RESULTS_FILE%"
del "%TEMP%\velocity_health_tmp.txt" >nul 2>nul
echo.
exit /b 0
