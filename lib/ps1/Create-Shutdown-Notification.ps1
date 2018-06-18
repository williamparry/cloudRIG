@'
param (
    [string]$reason = "AWS"
)
Add-Type -AssemblyName System.Windows.Forms
$Screen = [System.Windows.Forms.Screen]::PrimaryScreen
$Message = "Your computer is going to shut down in about 2 minutes.`nNow's a good time to save your game."

If ($reason -eq "AWS") {
    $Message += "`n(AWS is kicking you off)"
} Else {
    $Message += "`n(You scheduled it to shut down this billing hour)"
}

$Form = New-Object system.Windows.Forms.Form
$Form.BackColor = "#3e86ca"
$Form.TopMost = $true
$Form.Width = $Screen.Bounds.Width
$Form.Height = 300
$Form.FormBorderStyle = 'None'
$Form.StartPosition = 'Manual'
$Form.Top = 0
$Form.Left = ($Screen.Bounds.Width - $Form.Width)/2

$Text = New-Object system.windows.Forms.Label
$Text.Text = $Message
$Text.TextAlign = 'MiddleCenter'
$Text.Height = 200
$Text.Width = $Screen.Bounds.Width / 2
$TextX = ($Form.Width - $Text.Width) / 2
$Text.Location = New-Object System.Drawing.Point($TextX,25)
$Text.Font = "Microsoft Sans Serif,24"
$Text.ForeColor = "#ffffff"
$Form.controls.Add($Text)

If ($reason -eq "AWS") {

    $Ack = New-Object System.Windows.Forms.Button
    $Ack.Text = 'OK'
    $Ack.Width = 200
    $Ack.Height = 35
    $Ack.FlatStyle = 'Flat'
    $Ack.FlatAppearance.BorderColor = '#FFFFFF'
    $Ack.Font = "Microsoft Sans Serif,14,style=Bold"
    $Ack.ForeColor = "#ffffff"
    $AckX = $Form.Width / 2 - $Ack.Width
    $AckY = $Form.Height - $Ack.Height - 5
    $Ack.Location = new-object system.drawing.point($AckX,$AckY)

    $Ack.Add_Click({
        $Form.Close()
    })

    $Form.Controls.Add($Ack)

} else {
    $width = 200
    $okBtn = New-Object System.Windows.Forms.Button
    $okBtn.Text = 'OK'
    $okBtn.Width = $width
    $okBtn.Height = 35
    $okBtn.FlatStyle = 'Flat'
    $okBtn.FlatAppearance.BorderColor = '#FFFFFF'
    $okBtn.Font = "Microsoft Sans Serif,14,style=Bold"
    $okBtn.ForeColor = "#ffffff"
    $okBtnX = ($Form.Width / 2) - $width - 25
    $okBtnY = $Form.Height - $okBtn.Height - 5
    $okBtn.Location = New-Object System.Drawing.Point($okBtnX,$okBtnY)

    $okBtn.Add_Click({
        Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdownNotification -Confirm:$false
        $webclient = new-object net.webclient
        $instanceid = $webclient.Downloadstring('http://169.254.169.254/latest/meta-data/instance-id')
        Remove-EC2Tag -Resource $instanceid -Tag @{Key="scheduledstop"} -Force

        $Form.Close()
    })

    $Form.Controls.Add($okBtn)

    $cancelBtn = New-Object System.Windows.Forms.Button
    $cancelBtn.Text = 'Cancel Shutdown'
    $cancelBtn.Width = 200
    $cancelBtn.Height = 35
    $cancelBtn.FlatStyle = 'Flat'
    $cancelBtn.FlatAppearance.BorderColor = '#FFFFFF'
    $cancelBtn.Font = "Microsoft Sans Serif,14,style=Bold"
    $cancelBtn.ForeColor = "#ffffff"
    $cancelBtnX = ($Form.Width / 2)
    $cancelBtnY = $Form.Height - $cancelBtn.Height - 5
    $cancelBtn.Location = New-Object System.Drawing.Point($cancelBtnX,$cancelBtnY)

    $cancelBtn.Add_Click({
        $cancelBtn.Text = 'Cancelling...'
        $cancelBtn.Enabled = $false
        $okBtn.Enabled = $false
        Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdownNotification -Confirm:$false
        Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdown -Confirm:$false
        $webclient = new-object net.webclient
        $instanceid = $webclient.Downloadstring('http://169.254.169.254/latest/meta-data/instance-id')
        Remove-EC2Tag -Resource $instanceid -Tag @{Key="scheduledstop"} -Force
        $Form.Close()
    })

    $Form.Controls.Add($cancelBtn)
}

[void]$Form.ShowDialog()
$Form.Dispose()
'@ | Out-File 'c:\cloudRIG\Notify-Shutdown.ps1'

return "ok"