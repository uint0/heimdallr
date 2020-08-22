import subprocess

def realise(resources, ip):
    for resource in resources:
        for port in resource['ports']:
            port = str(port).replace('-',  ':')
            # TODO: error handle
            subprocess.run(['sudo', 'ufw', 'allow', 'from', str(ip), 'to', 'any', 'port', port])