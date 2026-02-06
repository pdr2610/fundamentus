// home.js - JavaScript para a página inicial (Hub de Notícias)

let currentNewsSource = 'all';
let currentChartSymbol = '';
let priceChart = null;

document.addEventListener('DOMContentLoaded', function() {
    loadNews();
    loadMarketMovers();
    loadMainStocks();
    loadIndices();
    setupNewsFilters();
    setupChartModal();
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
        const indicesOrder = ['IBOV', 'S&P 500', 'USD/BRL', 'BTC', 'SELIC'];

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
            } else if (name === 'S&P 500') {
                formattedPrice = price ? price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '--';
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

            // SELIC não tem gráfico
            const clickHandler = name === 'SELIC' ? '' : `onclick="openChartModal('${name}')"`;

            return `
                <div class="index-card" ${clickHandler}>
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

// Carrega maiores altas, baixas e destaques IFIX
async function loadMarketMovers() {
    try {
        const response = await fetch('/api/market-movers');
        const data = await response.json();

        renderHighlightList('winnersList', data.winners, 'winner');
        renderHighlightList('losersList', data.losers, 'loser');
        renderHighlightList('ifixList', data.ifix, 'ifix');
    } catch (error) {
        console.error('Erro ao carregar destaques:', error);
        document.getElementById('winnersList').innerHTML = '<div class="error">Erro ao carregar dados</div>';
        document.getElementById('losersList').innerHTML = '<div class="error">Erro ao carregar dados</div>';
        document.getElementById('ifixList').innerHTML = '<div class="error">Erro ao carregar dados</div>';
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
        const displayValue = `${changeSign}${(stock.changePercent || 0).toFixed(2)}%`;

        return `
            <div class="highlight-item" onclick="openChartModal('${stock.ticker}')">
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
                <div class="stock-ticker-card" onclick="openChartModal('${stock.ticker}')">
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

// ========== GRÁFICOS ==========

// Configura modal de gráfico
function setupChartModal() {
    const modal = document.getElementById('chartModal');
    const periodBtns = document.querySelectorAll('.period-btn');

    // Fecha modal ao clicar fora
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeChartModal();
        }
    });

    // Fecha modal com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeChartModal();
        }
    });

    // Event listeners para botões de período
    periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            periodBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadChartData(currentChartSymbol, this.dataset.period);
        });
    });
}

// Abre modal de gráfico
function openChartModal(symbol) {
    currentChartSymbol = symbol;
    const modal = document.getElementById('chartModal');

    // Atualiza título
    document.getElementById('chartSymbol').textContent = symbol;
    document.getElementById('chartPrice').textContent = '--';
    document.getElementById('chartChange').textContent = '--';
    document.getElementById('chartChange').className = 'chart-change';

    // Reset período para 1M
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === '1mo') {
            btn.classList.add('active');
        }
    });

    // Mostra modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Carrega dados
    loadChartData(symbol, '1mo');
}

// Fecha modal de gráfico
function closeChartModal() {
    const modal = document.getElementById('chartModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Destrói gráfico existente
    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
}

// Carrega dados do gráfico
async function loadChartData(symbol, period) {
    const loading = document.getElementById('chartLoading');
    loading.classList.add('active');

    try {
        const response = await fetch(`/api/chart/${encodeURIComponent(symbol)}?period=${period}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Atualiza preço atual
        if (data.currentPrice) {
            const currency = data.currency === 'USD' ? '$' : 'R$';
            document.getElementById('chartPrice').textContent =
                `${currency} ${data.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            // Calcula variação
            if (data.previousClose && data.data && data.data.length > 0) {
                const firstPrice = data.data[0].close;
                const change = data.currentPrice - firstPrice;
                const changePercent = ((data.currentPrice - firstPrice) / firstPrice) * 100;
                const changeSign = changePercent >= 0 ? '+' : '';
                const changeClass = changePercent >= 0 ? 'positive' : 'negative';

                document.getElementById('chartChange').textContent =
                    `${changeSign}${changePercent.toFixed(2)}%`;
                document.getElementById('chartChange').className = `chart-change ${changeClass}`;
            }
        }

        // Renderiza gráfico
        renderChart(data, period);

    } catch (error) {
        console.error('Erro ao carregar gráfico:', error);
    } finally {
        loading.classList.remove('active');
    }
}

// Renderiza gráfico com Chart.js
function renderChart(data, period) {
    const ctx = document.getElementById('priceChart').getContext('2d');

    // Destrói gráfico existente
    if (priceChart) {
        priceChart.destroy();
    }

    // Prepara dados
    const chartData = data.data || [];
    const labels = chartData.map(point => {
        const date = new Date(point.timestamp * 1000);
        if (period === '1d' || period === '5d') {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else if (period === '1mo' || period === '3mo') {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        } else {
            return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        }
    });
    const prices = chartData.map(point => point.close);

    // Determina cor baseado na performance
    const firstPrice = prices[0] || 0;
    const lastPrice = prices[prices.length - 1] || 0;
    const isPositive = lastPrice >= firstPrice;
    const lineColor = isPositive ? '#10b981' : '#ef4444';
    const bgColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    // Cria gráfico
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Preço',
                data: prices,
                borderColor: lineColor,
                backgroundColor: bgColor,
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: lineColor,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const currency = data.currency === 'USD' ? '$' : 'R$';
                            return `${currency} ${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(51, 65, 85, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(51, 65, 85, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            const currency = data.currency === 'USD' ? '$' : 'R$';
                            if (value >= 1000) {
                                return `${currency} ${(value / 1000).toFixed(1)}k`;
                            }
                            return `${currency} ${value.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}
