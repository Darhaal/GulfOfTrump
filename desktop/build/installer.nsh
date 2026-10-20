; Gulf of Trump's own pages on top of electron-builder's assisted installer
; (desktop/electron-builder.yml → nsis). The installer asks, in order: the
; language, a welcome, the licence, for whom and where to install, then which
; shortcuts to make, and offers to start the game at the end. The uninstaller
; asks whether to delete the saves and the ChatGPT sign-in as well.
;
; Updates (electron-updater runs the installer with --updated) ask nothing,
; keep the shortcuts as the player left them and never touch their data.
; This file is UTF-8 with a byte order mark, so NSIS reads its Cyrillic.

!include LogicLib.nsh

; A welcome page with the emblem on the side.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

; After the folder: which shortcuts to make. Both are on by default, and a
; silent install (no pages) makes both.
!macro customPageAfterChangeDir
  !include nsDialogs.nsh

  Var /GLOBAL noDesktopShortcut
  Var /GLOBAL noStartMenuShortcut
  Var /GLOBAL desktopShortcutBox
  Var /GLOBAL startMenuShortcutBox

  Page custom shortcutsPageShow shortcutsPageLeave

  Function shortcutsPageShow
    ${if} ${isUpdated}
      Abort
    ${endif}
    ${if} $LANGUAGE == 1049
      !insertmacro MUI_HEADER_TEXT "Ярлыки" "Откуда запускать Gulf of Trump."
      StrCpy $R1 "Ярлык на рабочем столе"
      StrCpy $R2 "Ярлык в меню «Пуск»"
    ${elseif} $LANGUAGE == 1058
      !insertmacro MUI_HEADER_TEXT "Ярлики" "Звідки запускати Gulf of Trump."
      StrCpy $R1 "Ярлик на робочому столі"
      StrCpy $R2 "Ярлик у меню «Пуск»"
    ${else}
      !insertmacro MUI_HEADER_TEXT "Shortcuts" "Where to start Gulf of Trump from."
      StrCpy $R1 "A shortcut on the desktop"
      StrCpy $R2 "A shortcut in the Start menu"
    ${endif}

    nsDialogs::Create 1018
    Pop $0
    ${if} $0 == error
      Abort
    ${endif}

    ${NSD_CreateCheckbox} 0 0 100% 14u "$R1"
    Pop $desktopShortcutBox
    ${if} $noDesktopShortcut != "1"
      ${NSD_Check} $desktopShortcutBox
    ${endif}

    ${NSD_CreateCheckbox} 0 20u 100% 14u "$R2"
    Pop $startMenuShortcutBox
    ${if} $noStartMenuShortcut != "1"
      ${NSD_Check} $startMenuShortcutBox
    ${endif}

    nsDialogs::Show
  FunctionEnd

  Function shortcutsPageLeave
    ${NSD_GetState} $desktopShortcutBox $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $noDesktopShortcut ""
    ${else}
      StrCpy $noDesktopShortcut "1"
    ${endif}
    ${NSD_GetState} $startMenuShortcutBox $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $noStartMenuShortcut ""
    ${else}
      StrCpy $noStartMenuShortcut "1"
    ${endif}
  FunctionEnd
!macroend

; The shortcuts chosen above (electron-builder's own are turned off). An
; update leaves the ones the player has, as they are.
!macro customInstall
  ${ifNot} ${isUpdated}
    ${if} $noDesktopShortcut != "1"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${endif}
    ${if} $noStartMenuShortcut != "1"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${endif}
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${endif}
!macroend

; Uninstalling: the shortcuts go (unless an update keeps them), and the
; player decides about their saves and the ChatGPT sign-in. They stay by
; default, so reinstalling brings everything back.
!macro customUnInstall
  ${ifNot} ${isKeepShortcuts}
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
    WinShell::UninstShortcut "$newStartMenuLink"
    Delete "$newStartMenuLink"
  ${endif}

  ${ifNot} ${isUpdated}
    ${if} $LANGUAGE == 1049
      StrCpy $R0 "Удалить и ваши сохранённые партии, и вход в ChatGPT на этом компьютере?$\r$\n$\r$\nЕсли их оставить, они вернутся, когда вы снова установите игру."
    ${elseif} $LANGUAGE == 1058
      StrCpy $R0 "Видалити й ваші збережені партії, і вхід у ChatGPT на цьому комп'ютері?$\r$\n$\r$\nЯкщо їх залишити, вони повернуться, коли ви знову встановите гру."
    ${else}
      StrCpy $R0 "Also delete your saved games and the ChatGPT sign-in on this computer?$\r$\n$\r$\nIf you keep them, they come back when you install the game again."
    ${endif}
    ${if} ${Cmd} `MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$R0" /SD IDNO IDYES`
      ; Electron keeps its data per user, whoever the game was installed for.
      ${if} $installMode == "all"
        SetShellVarContext current
      ${endif}
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      RMDir /r "$PROFILE\.gulf-of-trump"
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
    ${endif}
  ${endif}
!macroend
