Option Explicit
Dim fso, sh, base, q
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
q = Chr(34)
sh.CurrentDirectory = base
sh.Run "cmd /c " & q & base & "\Start.cmd" & q, 0, False