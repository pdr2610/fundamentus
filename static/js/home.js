// home.js - JavaScript para a página inicial (Hub de Notícias)

let currentNewsSource = 'all';

document.addEventListener('DOMContentLoaded', function() {
    loadNews();
    loadMarketMovers();
    loadMainStocks();
    loadIndices();
    setupNewsFilters();
});

// Configura filtros de notícias
function setupNewsFilters() {
    const filters = document.querySelectorAll('.news-filter');
    filters.forEach(filter => {
        filter.addEventListener('click', function() {
            // Remove active de todos
            filters.forEach(f => f.classList.remove('active'));
            // Adiciona active no clicado
            this.classList.add('active');
            // Carrega notícias da fonte selecionada
            currentNewsSource = this.dataset.source;
            loadNews(currentNewsSource);
        });
    });
}

// Carrega notícias
async function loadNews(source = 'all') {
    const container = document.getElementById('newsGrid');
    container.innerHTML = '<div class="loading">Carregando notícias...</div>';

    try {
        let url = '/api/news?limit=5';
        if (source !== 'all') {
            url = `/api/news/${source}?limit=10`;
        }

        const response = await fetch(url);
        const news = await response.json();

        if (!news || news.length === 0) {
            container.innerHTML = '<div class="no-data">Nenhuma notícia disponível no momento</div>';
            return;
        }

        container.innerHTML = news.slice(0, 12).map(item => `
            <a href="${item.link}" target="_blank" class="news-card">
                <div class="news-source">
                    <span class="source-icon">${item.source_icon}</span>
                    <span class="source-name">${item.source}</span>
                </div>
                <h3 class="news-title">${item.title}</h3>
                <p class="news-summary">${item.summary || ''}</p>
                <div class="news-meta">
                    ${item.category ? `<span class="news-category">${item.category}</span>` : ''}
                    <span class="news-date">${item.date}</span>
                </div>
            </a>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        container.innerHTML = '<div class="error">Erro ao carregar notícias. Tente novamente.</div>';
    }
}

// Carrega os índices principais
async function loadIndices() {
    const indicesGrid = document.getElementById('indicesGrid');

    try {
        const response = await fetch('/api/indices');
        const data = await response.json();

        // Ordem dos índices para exibição
        const indicesOrder = ['IBOV', 'IVV', 'USD/BRL', 'BTC', 'SELIC'];

        indicesGrid.innerHTML = indicesOrder.map(name => {
            const index = data[name];
            if (!index) {
                return `
                    <div class="index-card">
                        <span class="index-name">${name}</span>
                        <span class="index-value">--</span>
                        <span class="index-change">Indisponível</span>
                    </div>
                `;
            }

            const price = index.price;
            const changePercent = index.changePercent || 0;
            const changeClass = changePercent >= 0 ? 'positive' : 'negative';
            const changeSign = changePercent >= 0 ? '+' : '';

            // Formatação especial para cada índice
            let formattedPrice = '--';
            let formattedChange = '';

            if (name === 'IBOV') {
                formattedPrice = price ? price.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '--';
                formattedChange = `${changeSign}${changePercent.toFixed(2)}%`;
            } else if (name === 'IVV') {
                formattedPrice = price ? `$ ${price.toFixed(2)}` : '--';
                formattedChange = `${changeSign}${changePercent.toFixed(2)}%`;
            } else if (name === 'USD/BRL') {
                formattedPrice = price ? `R$ ${price.toFixed(4)}` : '--';
                formattedChange = `${changeSign}${changePercent.toFixed(2)}%`;
            } else if (name === 'BTC') {
                formattedPrice = price ? `$ ${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '--';
                formattedChange = `${changeSign}${changePercent.toFixed(2)}%`;
            } else if (name === 'SELIC') {
                formattedPrice = price ? `${price.toFixed(2)}%` : '--';
                formattedChange = 'a.a.';
            }

            return `
                <div class="index-card">
                    <span class="index-name">${name}</span>
                    <span class="index-value">${formattedPrice}</span>
                    <span class="index-change ${changeClass}">${formattedChange}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao carregar índices:', error);
        // Remove loading state mesmo em caso de erro
        const cards = indicesGrid.querySelectorAll('.index-card');
        cards.forEach(card => {
            card.classList.remove('loading-pulse');
            const valueEl = card.querySelector('.index-value');
            const changeEl = card.querySelector('.index-change');
            if (valueEl) valueEl.textContent = '--';
            if (changeEl) changeEl.textContent = 'Erro';
        });
    }
}

// Carrega maiores altas, baixas e volume
async function loadMarketMovers() {
    try {
        const response = await fetch('/api/market-movers');
        const data = await response.json();

        renderHighlightList('winnersList', data.winners, 'winner');
        renderHighlightList('losersList', data.losers, 'loser');
        renderHighlightList('volumeList', data.volume, 'volume');
    } catch (error) {
        console.error('Erro ao carregar destaques:', error);
        document.getElementById('winnersList').innerHTML = '<div class="error">Erro ao carregar dados</div>';
        document.getElementById('losersList').innerHTML = '<div class="error">Erro ao carregar dados</div>';
        document.getElementById('volumeList').innerHTML = '<div class="error">Erro ao carregar dados</div>';
    }
}

// Renderiza lista de destaques
function renderHighlightList(elementId, stocks, type) {
    const container = document.getElementById(elementId);

    if (!stocks || stocks.length === 0) {
        container.innerHTML = '<div class="no-data">Sem dados disponíveis</div>';
        return;
    }

    container.innerHTML = stocks.map(stock => {
        const changeClass = (stock.changePercent || 0) >= 0 ? 'positive' : 'negative';
        const changeSign = (stock.changePercent || 0) >= 0 ? '+' : '';

        let displayValue = '';
        if (type === 'volume') {
            displayValue = formatVolume(stock.volume);
        } else {
            displayValue = `${changeSign}${(stock.changePercent || 0).toFixed(2)}%`;
        }

        return `
            <div class="highlight-item" onclick="window.location.href='/fundamentos?ticker=${stock.ticker}'">
                <div class="highlight-info">
                    <span class="highlight-ticker">${stock.ticker}</span>
                    <span class="highlight-name">${stock.shortName || ''}</span>
                </div>
                <div class="highlight-data">
                    <span class="highlight-price">R$ ${(stock.price || 0).toFixed(2)}</span>
                    <span class="highlight-change ${changeClass}">${displayValue}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Carrega principais ações do Ibovespa
async function loadMainStocks() {
    const container = document.getElementById('mainStocksGrid');

    try {
        const response = await fetch('/api/ibovespa');
        const stocks = await response.json();

        if (!stocks || stocks.length === 0) {
            container.innerHTML = '<div class="no-data">Sem dados disponíveis</div>';
            return;
        }

        container.innerHTML = stocks.map(stock => {
            const changeClass = (stock.changePercent || 0) >= 0 ? 'positive' : 'negative';
            const changeSign = (stock.changePercent || 0) >= 0 ? '+' : '';
            const arrow = (stock.changePercent || 0) >= 0 ? '▲' : '▼';

            return `
                <div class="stock-ticker-card" onclick="window.location.href='/fundamentos?ticker=${stock.ticker}'">
                    <div class="ticker-header">
                        <span class="ticker-symbol">${stock.ticker}</span>
                        <span class="ticker-name">${stock.shortName || ''}</span>
                    </div>
                    <div class="ticker-price">R$ ${(stock.price || 0).toFixed(2)}</div>
                    <div class="ticker-change ${changeClass}">
                        <span class="change-arrow">${arrow}</span>
                        <span>${changeSign}${(stock.changePercent || 0).toFixed(2)}%</span>
                    </div>
                    <div class="ticker-volume">Vol: ${formatVolume(stock.volume)}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar ações:', error);
        container.innerHTML = '<div class="error">Erro ao carregar cotações</div>';
    }
}

// Formata volume para exibição
function formatVolume(volume) {
    if (!volume) return '--';
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
    return volume.toString();
}

// Formata market cap para exibição
function formatMarketCap(marketCap) {
    if (!marketCap) return '--';
    if (marketCap >= 1e12) return 'R$ ' + (marketCap / 1e12).toFixed(2) + 'T';
    if (marketCap >= 1e9) return 'R$ ' + (marketCap / 1e9).toFixed(2) + 'B';
    if (marketCap >= 1e6) return 'R$ ' + (marketCap / 1e6).toFixed(2) + 'M';
    return 'R$ ' + marketCap.toFixed(2);
}
