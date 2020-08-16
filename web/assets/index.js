(async function() {
    "use strict";

    const API_URL = 'http://localhost:8000';

    async function getMetaData() {
        return await fetch(`${API_URL}/heimdallr`);
    }

    async function validateToken(token) {
        return await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: JSON.stringify({token, dryrun: true}),
            headers: {'Content-Type': 'application/json'}
        });
    }

    async function enableIP(token) {
        return await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: JSON.stringify({token, dryrun: false}),
            headers: {'Content-Type': 'application/json'}
        });
    }

    /*
    render([
        {
            'tag': 'p',
            'attrs': {a: 'b'},
            'classList': ['class1', 'class2'],
            'text': 'text',
            'children': [
                {'tag': 'a'}
            ],
            'var': 'name'
        }
    ]) -> {'dom': [
        <p a="b" class="class1 class2">text<a></a></p>
    ], 'vars': {'name': <p ^...></p>}
    */
    function render(def) {
        if(def instanceof Array) {
            const root = def.map(indDef => render(indDef));
            return {
                'dom': root.map(res => res.dom),
                'vars': root.reduce((t, v) => ({...t, ...v.vars}), {})
            };
        }

        // 1. Render the element
        const el = document.createElement(def.tag);
        const vars = def.var ? {[def.var]: el} : {};

        def.attrs     && Object.entries(def.attrs).forEach(([k, v]) => el.setAttribute(k, v));
        def.classList && def.classList.forEach(cls => el.classList.add(cls));
        def.text      && (el.textContent = def.text);

        // 2. Deal with children
        if(def.children) {
            def.children
              .map(childDef => render(childDef))
              .forEach(chld => {
                  el.appendChild(chld.dom);
                  Object.entries(chld.vars).forEach(([nm, e]) => vars[nm] = e);
              });
        }

        // 4. Return
        return {
            'dom': el,
            'vars': vars 
        }
    }

    function tablify(headings, data) {
        const thead = {
            tag: 'thead',
            children: [{
                tag: 'tr',
                children: headings.map(heading => ({tag: 'th', text: heading}))
            }]
        };
        const tbody = {
            tag: 'tbody',
            children: data.map(row => ({
                tag: 'tr',
                children: row.map(cell => ({
                    tag: 'td',
                    text: cell
                }))
            }))
        };
        return {
            tag: 'table',
            children: [thead, tbody]
        };
    }

    function icon(name) {
        return render({
            tag: 'i',
            classList: [`icon-${name}`]
        }).dom;
    }

    async function waitData(promise, btn) {
        const content = btn.textContent;
        const spinner = icon('spinner');
        spinner.classList.add('loading-spinner');

        btn.classList.remove('btn-next');
        btn.disabled = true;
        btn.textContent = '';
        btn.appendChild(spinner);

        const res = await promise;

        btn.innerHTML = '';
        btn.classList.add('btn-next');
        btn.disabled = false; 
        btn.textContent = content;

        return res;
    }

    class CardController {
        constructor(header, content, footer) {
            this.card = {header, content, footer};
            this.screenNo = -1;
            this.steps = [];
        }

        init(ctx) {
            this.forward(ctx);
        }

        addStep(step) {
            this.steps.push(step);
        }

        forward(ctx) {
            this.screenNo++;
            this.render(ctx);
        }

        back(ctx) {
            this.screenNo--;
            this.render(ctx);
        }

        render(ctx) {
            this.steps[this.screenNo](this.card, this, ctx);
        }
    }

    const header  = document.querySelector('.card header');
    const content = document.querySelector('.card .card-body');
    const footer  = document.querySelector('.card footer');

    const controller = new CardController(header, content, footer);
    controller.addStep((card, controller, ctx) => {
        const body = render([
            {
                tag: 'p',
                text: `To access ${ctx.name} please enter your access token below.`
            },
            {
                tag: 'p',
                classList: ['main-content'], 
                children: [
                    {
                        tag: 'label',
                        attrs: {for: 'token'},
                        text: 'Access Token'
                    },
                    {
                        tag: 'input',
                        attrs: {
                            type: 'text',
                            id: 'token',
                            placeholder: 'CorrectHorseBatteryStaple',
                            autocomplete: 'off'
                        },
                        var: 'input'
                    }
                ]
            },
            {
                tag: 'p',
                classList: ['feedback', 'text-error'],
                var: 'feedback'
            }
        ]);
        const foot = render({
            tag: 'button',
            classList: ['button', 'primary', 'btn-next'],
            text: 'Next',
            var: 'submit'
        });

        content.innerHTML = '';
        footer.innerHTML = '';

        body.dom.forEach(el => card.content.appendChild(el));
        card.footer.appendChild(foot.dom);

        foot.vars.submit.addEventListener('click', async () => {
            const token = body.vars.input.value;

            body.vars.feedback.innerHTML = '';
            const res = await waitData(validateToken(token), foot.vars.submit);

            if(res.ok) {
                controller.forward({info: await res.json(), token, meta: ctx});
            } else {
                let error = 'Unknown Error'
                if(res.status == 404) {
                    error = 'Unknown Token';
                }
                body.vars.feedback.appendChild(icon('error'));
                body.vars.feedback.appendChild(render({tag: 'span', text: error}).dom)
            }
        });
    });
    controller.addStep((card, controller, {info, token, meta}) => {
        card.content.innerHTML = '';
        card.footer.innerHTML = '';

        const refreshTime = new Date(Date.now()+info.token.refresh*1000).toLocaleDateString();
        const body = render([
            {tag: 'p', text: 'Access token validated. Please confirm your access rights below.'},
            {tag: 'p', text: `Access will expire on ${refreshTime}. Please re-enter your token at that time.`},
            {
                tag: 'p',
                classList: ['main-content'],
                children: [
                    {tag: 'h4', children: [
                        {tag: 'b', text: 'From: '},
                        {tag: 'code', text: info.requester}
                    ]},
                    tablify(
                        ['Host', 'Port', 'Action'],
                        info.token.access.flatMap(hostDef => hostDef.ports.map(prt => [
                            hostDef.host, prt, 'Allow'
                        ]))
                    )
                ]
            }
        ]);
        const foot = render([
            {tag: 'button', classList: ['button', 'secondary', 'btn-prev'], text: 'Back', var: 'back'},
            {tag: 'button', classList: ['button', 'primary', 'btn-next'],   text: 'Confirm', var: 'confirm'}
        ])

        body.dom.forEach(e => card.content.appendChild(e));
        foot.dom.forEach(e => card.footer.appendChild(e));

        foot.vars.back.addEventListener('click', () => {
            controller.back(meta);
        });
        foot.vars.confirm.addEventListener('click', async () => {
            await waitData(enableIP(token), foot.vars.confirm);
            controller.forward();
        });
    });
    controller.addStep((card) => {
        card.content.innerHTML = '';
        card.footer.innerHTML = '';

        const body = render({
            tag: 'p',
            classList: ['text-center', 'main-content'],
            text: 'Access has been successfully provisioned. You may now close the page.'
        });

        card.content.appendChild(body.dom);
    });

    const meta = await getMetaData();
    controller.init(await meta.json());
})()