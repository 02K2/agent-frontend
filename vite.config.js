import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '/geo-proxy': {
                target: 'http://10.101.250.91:5000',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/geo-proxy/, ''); },
            },
            // 瓦片代理: 浏览器拿不到公网瓦片 (ERR_NAME_NOT_RESOLVED),
            // 让 Vite dev server 进程去拉高德瓦片再透回浏览器.
            // OL 的 url template 写: /tile-proxy/?lang=zh_cn&...&x={x}&y={y}&z={z}
            // 我们把整个 query 拼好, 代理原样转发到高德 (去掉 /tile-proxy 前缀).
            '/tile-proxy': {
                target: 'https://webrd01.is.autonavi.com',
                changeOrigin: true,
                secure: true,
                // 浏览器发的 path 是: /tile-proxy/?lang=...&x=11&y=12&z=8
                // 先用 rewrite 去掉 /tile-proxy 前缀, 留下 /?lang=...
                rewrite: function (path) { return path.replace(/^\/tile-proxy/, ''); },
                // 再用 configure 把 /?lang=... 改成 /appmaptile?lang=...
                configure: function (proxy) {
                    proxy.on('proxyReq', function (proxyReq) {
                        var original = proxyReq.path;
                        if (original.startsWith('/?')) {
                            proxyReq.path = '/appmaptile' + original.slice(1);
                        }
                        else if (original === '/') {
                            proxyReq.path = '/appmaptile';
                        }
                    });
                },
            },
        },
    },
});
