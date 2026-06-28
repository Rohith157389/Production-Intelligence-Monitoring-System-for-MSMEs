$ids = 11536,16664,27604
foreach ($id in $ids) {
    try {
        Stop-Process -Id $id -Force -ErrorAction Stop
        Write-Output "Stopped $id"
    } catch {
        Write-Output "Could not stop $id"
    }
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Depth 3