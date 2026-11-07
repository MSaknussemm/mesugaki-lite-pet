Option Explicit
Dim fso, sh, base, q, exe
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
q = Chr(34)
exe = base & "\runtime\electron.exe"
If Not fso.FileExists(exe) Then
  MsgBox "runtime\electron.exe is missing." & vbCrLf & vbCrLf & _
         "Run setup.cmd first, or re-extract the package.", 16, "Mesugaki Lite Pet"
  WScript.Quit 1
End If
On Error Resume Next
sh.Environment("PROCESS").Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0
sh.CurrentDirectory = base
sh.Run q & exe & q & " " & q & base & q, 0, False