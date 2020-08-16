import falcon
import json

DEFAULT_ACCESS = 60*60*24*7  # 1 week

def process_tokens(perm_file, refresh=DEFAULT_ACCESS):
    parsed = json.load(open(perm_file))
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

tokens = process_tokens('../config/permissions.json')

class HeimdallrController:
    def on_get(self, req, resp):
        resp.media = {
            'name': 'ark.tet'
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
        
        resp.status = falcon.HTTP_200
        resp.media = {
            'requester': req.remote_addr,
            'token': tokens[req.media['token']],
            'access': {'provision': success}
        }

class HandleCORS(object):
    def process_request(self, req, resp):
        resp.set_header('Access-Control-Allow-Origin', '*')
        resp.set_header('Access-Control-Allow-Methods', '*')
        resp.set_header('Access-Control-Allow-Headers', '*')
        resp.set_header('Access-Control-Max-Age', 1728000)  # 20 days

api = falcon.API(middleware=[HandleCORS()])
api.add_route('/token', TokenController())
api.add_route('/heimdallr', HeimdallrController())