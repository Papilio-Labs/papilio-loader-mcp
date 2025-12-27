import serial.tools.list_ports
import json

ports = serial.tools.list_ports.comports()
print(f"Found {len(ports)} ports:\n")

for p in ports:
    print(f"Device: {p.device}")
    print(f"Description: {p.description}")
    print(f"HWID: {p.hwid}")
    print(f"VID:PID: {p.vid}:{p.pid}")
    print(f"Manufacturer: {p.manufacturer}")
    print("-" * 60)
