import adapters.ufw as a_ufw
import falcon
import json

DEFAULT_ACCESS = 60*60*24*7  # 1 week
default_adapter = a_ufw

def load_configuration(config_file):
    parsed = json.load(open(config_file))
    tokens = process_tokens(
        parsed['permissions'],
        refresh=parsed['refresh'] if 'refersh' in parsed else DEFAULT_ACCESS
    )

    return parsed['name'], tokens

def process_tokens(parsed, refresh=DEFAULT_ACCESS):
    resource_map = parsed['resources']
    token_map = parsed['tokens']

    tokens = {}
    for token in token_map:
        access = []
        for resource in token['resources']:
            access.append(resource_map[resource])
        tokens[token['token']] = {
            'access': access,
            'refresh': refresh
        }
    return tokens

name, tokens = load_configuration('../config/configuration.json')

class HeimdallrController:
    def on_get(self, req, resp):
        resp.media = {
            'name': name
        }

class TokenController:
    def on_post(self, req, resp):
        if 'token' not in req.media:
            resp.status = falcon.HTTP_400
            resp.media = {'error': 'Request must have `token`'}
            return
        
        if req.media['token'] not in tokens:
            resp.status = falcon.HTTP_404
            resp.media = {'error': 'Unknown Token'}
            return

        success = False
        if 'dryrun' not in req.media or not req.media['dryrun']:
            success = True
        else:
            default_adapter.realise()
        
        resp.status = falcon.HTTP_200
        resp.media = {
            'requester': req.remote_addr,
            'token': tokens[req.media['token']],
            'access': {'provision': success}
        }

api = falcon.API()
api.add_route('/api/token', TokenController())
api.add_route('/api/heimdallr', HeimdallrController())