# ─── Windows Speech Recognition Worker for ARIA ───────────────────────────────
# Uses .NET System.Speech.Recognition for 100% offline, local voice input.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Speech

try {
    $sre = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $grammar = New-Object System.Speech.Recognition.DictationGrammar
    $sre.LoadGrammar($grammar)
    $sre.SetInputToDefaultAudioDevice()
} catch {
    [Console]::Out.WriteLine("ERROR:INIT_FAILED:" + $_.Exception.Message)
    [Console]::Out.Flush()
    exit 1
}

$isListening = $false

Register-ObjectEvent -InputObject $sre -EventName SpeechRecognized -Action {
    param($sender, $eventArgs)
    $text = $eventArgs.Result.Text
    $confidence = $eventArgs.Result.Confidence
    if ($text) {
        [Console]::Out.WriteLine("SPEECH_RECOGNIZED:" + $text)
        [Console]::Out.Flush()
    }
} | Out-Null

Register-ObjectEvent -InputObject $sre -EventName SpeechHypothesized -Action {
    param($sender, $eventArgs)
    $text = $eventArgs.Result.Text
    if ($text) {
        [Console]::Out.WriteLine("SPEECH_HYPOTHESIZED:" + $text)
        [Console]::Out.Flush()
    }
} | Out-Null

Register-ObjectEvent -InputObject $sre -EventName RecognizeCompleted -Action {
    param($sender, $eventArgs)
    [Console]::Out.WriteLine("RECOGNIZE_COMPLETED")
    [Console]::Out.Flush()
} | Out-Null

[Console]::Out.WriteLine("VOICE_ENGINE_READY")
[Console]::Out.Flush()

# Command loop on stdin
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($line -eq $null -or $line -eq "QUIT") {
        break
    }
    $cmd = $line.Trim()

    if ($cmd -eq "START") {
        try {
            $sre.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Single)
            $isListening = $true
            [Console]::Out.WriteLine("STARTED")
            [Console]::Out.Flush()
        } catch {
            [Console]::Out.WriteLine("ERROR:START_FAILED:" + $_.Exception.Message)
            [Console]::Out.Flush()
        }
    }
    elseif ($cmd -eq "STOP") {
        try {
            if ($isListening) {
                $sre.RecognizeAsyncStop()
                $isListening = $false
            }
            [Console]::Out.WriteLine("STOP_REQUESTED")
            [Console]::Out.Flush()
        } catch {
            [Console]::Out.WriteLine("ERROR:STOP_FAILED:" + $_.Exception.Message)
            [Console]::Out.Flush()
        }
    }
    elseif ($cmd -eq "CANCEL") {
        try {
            if ($isListening) {
                $sre.RecognizeAsyncCancel()
                $isListening = $false
            }
            [Console]::Out.WriteLine("CANCELLED")
            [Console]::Out.Flush()
        } catch {
            [Console]::Out.WriteLine("ERROR:CANCEL_FAILED:" + $_.Exception.Message)
            [Console]::Out.Flush()
        }
    }
}

try {
    $sre.Dispose()
} catch {}

[Console]::Out.WriteLine("EXITED")
[Console]::Out.Flush()
exit 0
