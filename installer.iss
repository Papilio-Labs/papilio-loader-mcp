; Inno Setup Script for Papilio Loader Desktop Application
; Requires Inno Setup 6.0 or later (https://jrsoftware.org/isinfo.php)

#define MyAppName "Papilio Loader"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Gadget Factory"
#define MyAppURL "https://github.com/GadgetFactory/papilio-loader-mcp"
#define MyAppExeName "PapilioLoader.exe"

[Setup]
; App identification
AppId={{8B7D9F3E-4C5A-4D6B-9E2F-1A3B5C7D9E0F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
VersionInfoVersion={#MyAppVersion}

; Installation directories
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output
OutputDir=installer_output
OutputBaseFilename=PapilioLoader-Setup-{#MyAppVersion}
SetupIconFile=

; Compression
Compression=lzma
SolidCompression=yes

; Platform and compatibility
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
MinVersion=10.0.17763
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Appearance
WizardStyle=modern
DisableWelcomePage=no
LicenseFile=

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Run at Windows startup"; GroupDescription: "Additional options:"; Flags: unchecked

[Files]
; The main executable
Source: "dist\PapilioLoader.exe"; DestDir: "{app}"; Flags: ignoreversion

; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Icons]
; Start Menu shortcut
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Desktop shortcut (if selected)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

; Startup shortcut (if selected)
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startup

[Run]
; Option to launch the application after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  
  // Check if the application is already running
  if CheckForMutexes('PapilioLoader') then
  begin
    if MsgBox('Papilio Loader is currently running. Setup cannot continue unless it is closed.' + #13#10#13#10 + 
              'Do you want to close it now?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      // Try to close gracefully
      // Note: This is a simplified approach. For production, you might want to implement
      // a more robust process termination mechanism
      Exec('taskkill', '/F /IM PapilioLoader.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(1000);
      Result := not CheckForMutexes('PapilioLoader');
      if not Result then
        MsgBox('Failed to close Papilio Loader. Please close it manually and try again.', mbError, MB_OK);
    end
    else
      Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDataDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Create the user data directory in AppData
    AppDataDir := ExpandConstant('{localappdata}\papilio-loader-mcp');
    if not DirExists(AppDataDir) then
      CreateDir(AppDataDir);
  end;
end;

[UninstallDelete]
; Clean up user data on uninstall (optional - user might want to keep their files)
; Type: filesandordirs; Name: "{localappdata}\papilio-loader-mcp"

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nPapilio Loader is a desktop application for flashing FPGA bit files and ESP32 firmware to your devices.%n%nThe application will run in your system tray and provide a web interface for easy device programming.
