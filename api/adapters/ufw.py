import ufw

def realise(resources, ip):
    for resource in resources:
        for port in resource['ports']:
            port = port.replace('-',  ':')
            ufw.allow(f"allow from {ip} to any port {port}")