; Smart School Tool's own look for the Windows setup wizard: the app's dark night-sky colours, its own
; pictures (made by installer/make-art.py) and friendlier words. electron-builder adds this before its pages.

; Dark top bar, Welcome and Finish pages with white writing, and a dark install log.
!define MUI_BGCOLOR 0B0F1A
!define MUI_TEXTCOLOR FFFFFF
!define MUI_INSTFILESPAGE_COLORS "E6EAF2 0B0F1A"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Stop installing Smart School Tool?"

!ifndef BUILD_UNINSTALLER
  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Smart School Tool"
    !define MUI_WELCOMEPAGE_TITLE_3LINES
    !define MUI_WELCOMEPAGE_TEXT "Log your study time, hand in assignments with Quick submit and send your teachers a weekly report, all from one place.$\r$\n$\r$\nThis takes less than a minute. The app keeps itself up to date after it's installed.$\r$\n$\r$\nClick Next to get started."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; Read by the Finish page that electron-builder adds (it also adds the "open the app" tick box).
  !define MUI_FINISHPAGE_TITLE "You're all set!"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "Smart School Tool is installed. You'll find it on your desktop and in the Start menu.$\r$\n$\r$\nLog in or create a free account to get started."
  !define MUI_FINISHPAGE_RUN_TEXT "Open Smart School Tool now"
  !define MUI_FINISHPAGE_LINK "Get it for your Chromebook or Mac too"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://notisaac132-star.github.io/Isaac-s-Smart-School-Tool/"
  !define MUI_FINISHPAGE_LINK_COLOR 7AA2FF
!endif
