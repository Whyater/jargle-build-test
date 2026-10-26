function Install-Jargle {
    $oldProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    $setup = Join-Path $env:TEMP 'Jargle-windows-setup.exe'
    try {
        if ($PSVersionTable.PSVersion.Major -lt 6) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        }
        $base = $env:JARGLE_RELEASES_BASE
        if ([string]::IsNullOrWhiteSpace($base)) {
            $base = 'https://github.com/Whyater/Jargle/releases/latest/download'
        }
        $base = $base.TrimEnd('/')
        $url = $base + '/Jargle-windows-setup.exe'
        Write-Host 'Jargle: downloading the Windows installer.'
        Invoke-WebRequest -Uri $url -OutFile $setup -UseBasicParsing -ErrorAction Stop

        Get-Process Jargle -ErrorAction SilentlyContinue | Stop-Process -Force
        $result = Start-Process -FilePath $setup -ArgumentList '/S' -Wait -PassThru
        if ($result.ExitCode -ne 0) {
            throw "the installer returned exit code $($result.ExitCode)"
        }
    } catch {
        # Throw so scripts and CI see the failure; the window stays open when run with irm | iex.
        throw "Jargle: install failed: $($_.Exception.Message)"
    } finally {
        if (Test-Path $setup) { Remove-Item $setup -Force -ErrorAction SilentlyContinue }
        $ProgressPreference = $oldProgress
    }

    $exe = $null
    $key = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Jargle' -ErrorAction SilentlyContinue
    if ($null -ne $key -and $key.DisplayIcon) {
        $icon = [string]$key.DisplayIcon
        $icon = $icon.Trim() -replace ',0$',''
        $icon = $icon.Trim().Trim('"')
        if (Test-Path $icon) { $exe = $icon }
    }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Jargle\Jargle.exe')
        (Join-Path $env:LOCALAPPDATA 'Programs\Jargle\Jargle.exe')
    )
    foreach ($candidate in $candidates) {
        if ($null -eq $exe -and (Test-Path $candidate)) { $exe = $candidate }
    }
    if ($null -eq $exe) {
        Write-Host 'Jargle: installed, but Jargle.exe was not found.'
        return
    }
    Write-Host "Jargle: installed to $exe"
    # The setup includes the WebView2 bootstrapper, so missing WebView2 gets installed.
    if ($env:JARGLE_NO_LAUNCH -ne '1') { Start-Process -FilePath $exe }
    Write-Host 'Jargle: uninstall from Settings > Apps > Jargle, or run uninstall.exe next to Jargle.exe.'
}
Install-Jargle
