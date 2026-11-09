$ErrorActionPreference = 'Stop'
$link = Get-Content -LiteralPath '.vercel/project.json' -Raw | ConvertFrom-Json
if ($link.projectId -ne 'prj_f4doLF5dbnhDNXeEvq9wJniGT4lM' -or $link.orgId -ne 'team_H9dRefsL7wFLUIZMoOnT2vkQ') {
  throw 'El proyecto de Vercel no es MenuPro.'
}
$settings = @{}
foreach ($line in (Get-Content -LiteralPath '.env.local')) {
  if ($line -match '^([A-Z_]+)=(.*)$') {
    $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
$keys = @('DATABASE_URL','DATABASE_URL_UNPOOLED','NEON_AUTH_BASE_URL','NEON_AUTH_COOKIE_SECRET','MENUPRO_WORKER_SECRET')
foreach ($setting in $keys) {
  if ([string]::IsNullOrWhiteSpace($settings[$setting])) { throw "Falta $setting." }
}
foreach ($setting in $keys) {
  # The secret goes only to stdin. Capture all CLI output rather than risking
  # disclosure from a prompt or an upstream error response.
  $start = [System.Diagnostics.ProcessStartInfo]::new()
  $start.FileName = (Get-Process -Id $PID).Path
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  foreach ($argument in @('-NoLogo','-NoProfile','-NonInteractive','-Command',"pnpm dlx vercel@65.12.1 env add $setting --environment production --sensitive --force --yes")) {
    $start.ArgumentList.Add($argument)
  }
  $process = [System.Diagnostics.Process]::Start($start)
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()
  # Write rather than WriteLine: a newline would become part of the secret.
  $process.StandardInput.Write($settings[$setting])
  $process.StandardInput.Close()
  $process.WaitForExit()
  $result = $stdout.GetAwaiter().GetResult()
  $errorResult = $stderr.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) { throw "No se pudo guardar $setting en Vercel. Revisa la sesión y los permisos." }
  Write-Output "Guardado en production: $setting"
}
