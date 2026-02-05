// home.js - JavaScript para a página inicial (Hub de Notícias)

document.addEventListener('DOMContentLoaded', function() {
    loadMarketMovers();
    loadMainStocks();
    loadIndices();
});

// Carrega os índices principais
async function loadIndices() {
    // Para os índices, vamos usar dados simulados ou da brapi
    // A brapi não fornece índices gratuitamente, então usamos placeholders
    const indicesGrid = document.getElementById('indicesGrid');

    // Remove loading state
    const cards = indicesGrid.querySelectorAll('.index-card');
    cards.forEach(card => {
        card.classList.remove('loading-pulse');
    });

    // Por enquanto, mostramos indicação de que os índices requerem API premium
    // Em produção, você integraria com uma API de índices
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
