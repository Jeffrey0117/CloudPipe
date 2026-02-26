$action = New-ScheduledTaskAction -Execute 'curl.exe' -Argument '-s http://localhost:4007/api/cron/snapshot'
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName 'upimg-daily-snapshot' -Action $action -Trigger $trigger -Description 'Daily snapshot for duk.tw image hosting'
Write-Host 'Scheduled task created successfully!'
