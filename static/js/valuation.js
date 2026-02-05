// valuation.js - JavaScript para a página de Valuation

let tickersList = [];
let currentStockData = null;
let valuationChart = null;

document.addEventListener('DOMContentLoaded', function() {
    loadTickers();
    setupEventListeners();
});

// Carrega lista de tickers disponíveis
async function loadTickers() {
    try {
        const response = await fetch('/api/tickers');
        tickersList = await response.json();
    } catch (error) {
        console.error('Erro ao carregar tickers:', error);
    }
}

// Configura event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('tickerSearch');
    const searchResults = document.getElementById('searchResults');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const calculateBtn = document.getElementById('calculateBtn');

    // Busca de ticker
    searchInput.addEventListener('input', function() {
        const query = this.value.toUpperCase().trim();

        if (query.length < 1) {
            searchResults.style.display = 'none';
            return;
        }

        const matches = tickersList.filter(t => t.includes(query)).slice(0, 10);

        if (matches.length > 0) {
            searchResults.innerHTML = matches.map(ticker =>
                `<div class="search-result-item" data-ticker="${ticker}">${ticker}</div>`
            ).join('');
            searchResults.style.display = 'block';
        } else {
            searchResults.style.display = 'none';
        }
    });

    // Seleciona resultado da busca
    searchResults.addEventListener('click', function(e) {
        if (e.target.classList.contains('search-result-item')) {
            const ticker = e.target.dataset.ticker;
            searchInput.value = ticker;
            searchResults.style.display = 'none';
        }
    });

    // Fecha resultados ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-wrapper')) {
            searchResults.style.display = 'none';
        }
    });

    // Botão analisar
    analyzeBtn.addEventListener('click', analyzeStock);

    // Enter para analisar
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            analyzeStock();
        }
    });

    // Botão calcular
    calculateBtn.addEventListener('click', calculateValuation);

    // Recalcular ao mudar inputs
    document.querySelectorAll('.method-inputs input').forEach(input => {
        input.addEventListener('change', calculateValuation);
    });
}

// Analisa a ação selecionada
async function analyzeStock() {
    const ticker = document.getElementById('tickerSearch').value.toUpperCase().trim();

    if (!ticker) {
        alert('Digite um ticker para analisar');
        return;
    }

    try {
        const response = await fetch(`/api/stocks/${ticker}`);

        if (!response.ok) {
            alert('Ação não encontrada');
            return;
        }

        currentStockData = await response.json();
        displayStockInfo();
        populateInputs();
        showSections();
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        alert('Erro ao buscar dados da ação');
    }
}

// Exibe informações da empresa
function displayStockInfo() {
    const data = currentStockData;

    document.getElementById('companyTicker').textContent = data.ticker;

    // Nome da empresa (da brapi se disponível)
    const companyName = data.brapi?.shortName || data.brapi?.longName || data.ticker;
    document.getElementById('companyName').textContent = companyName;

    // Setor
    const sector = data.brapi?.sector || '--';
    document.getElementById('companySector').textContent = sector;

    // Preço atual
    const currentPrice = data.brapi?.regularMarketPrice || data['Cotação'] || 0;
    document.getElementById('currentPrice').textContent = `R$ ${currentPrice.toFixed(2)}`;

    // Variação
    const change = data.brapi?.regularMarketChangePercent || 0;
    const changeEl = document.getElementById('priceChange');
    const changeSign = change >= 0 ? '+' : '';
    changeEl.textContent = `${changeSign}${change.toFixed(2)}%`;
    changeEl.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
}

// Preenche inputs com dados da ação
function populateInputs() {
    const data = currentStockData;

    // LPA (Lucro por Ação)
    const lpa = data['LPA'] || 0;
    document.getElementById('grahamLPA').value = lpa.toFixed(2);
    document.getElementById('plLPA').value = lpa.toFixed(2);

    // VPA (Valor Patrimonial por Ação)
    const vpa = data['VPA'] || 0;
    document.getElementById('grahamVPA').value = vpa.toFixed(2);

    // DPA (Dividendo por Ação) - calculado a partir do DY e cotação
    const dy = data['DY'] || 0;
    const cotacao = data.brapi?.regularMarketPrice || data['Cotação'] || 0;
    const dpa = (dy / 100) * cotacao;
    document.getElementById('bazinDPA').value = dpa.toFixed(2);
    document.getElementById('gordonDPA').value = (dpa * 1.03).toFixed(2); // DPA esperado com crescimento
}

// Mostra seções ocultas
function showSections() {
    document.getElementById('companyOverview').style.display = 'block';
    document.getElementById('valuationMethods').style.display = 'block';
    document.getElementById('fundamentalsRecap').style.display = 'block';

    displayFundamentals();
}

// Exibe indicadores fundamentalistas
function displayFundamentals() {
    const data = currentStockData;
    const grid = document.getElementById('fundamentalsGrid');

    const indicators = [
        { label: 'P/L', value: data['P/L'], format: 'decimal' },
        { label: 'P/VP', value: data['P/VP'], format: 'decimal' },
        { label: 'DY', value: data['DY'], format: 'percent' },
        { label: 'ROE', value: data['ROE'], format: 'percent' },
        { label: 'ROIC', value: data['ROIC'], format: 'percent' },
        { label: 'Margem Líquida', value: data['Marg. Líquida'], format: 'percent' },
        { label: 'Dív. Líq./EBIT', value: data['Dív. Líq./EBIT'], format: 'decimal' },
        { label: 'LPA', value: data['LPA'], format: 'currency' },
        { label: 'VPA', value: data['VPA'], format: 'currency' },
        { label: 'Cotação', value: data.brapi?.regularMarketPrice || data['Cotação'], format: 'currency' },
        { label: 'Cresc. 5 anos', value: data['Cresc. 5 anos'], format: 'percent' },
        { label: 'Liq. Corrente', value: data['Liq. Corrente'], format: 'decimal' }
    ];

    grid.innerHTML = indicators.map(ind => {
        let displayValue = '--';
        if (ind.value !== undefined && ind.value !== null) {
            switch (ind.format) {
                case 'percent':
                    displayValue = (ind.value * 100).toFixed(2) + '%';
                    break;
                case 'currency':
                    displayValue = 'R$ ' + ind.value.toFixed(2);
                    break;
                default:
                    displayValue = ind.value.toFixed(2);
            }
        }

        return `
            <div class="fundamental-item">
                <span class="fundamental-label">${ind.label}</span>
                <span class="fundamental-value">${displayValue}</span>
            </div>
        `;
    }).join('');
}

// Calcula valuation
function calculateValuation() {
    if (!currentStockData) {
        alert('Selecione uma ação primeiro');
        return;
    }

    const currentPrice = currentStockData.brapi?.regularMarketPrice || currentStockData['Cotação'] || 0;

    // Graham
    const grahamLPA = parseFloat(document.getElementById('grahamLPA').value) || 0;
    const grahamVPA = parseFloat(document.getElementById('grahamVPA').value) || 0;
    const grahamResult = calculateGraham(grahamLPA, grahamVPA);
    displayResult('graham', grahamResult, currentPrice);

    // Bazin
    const bazinDPA = parseFloat(document.getElementById('bazinDPA').value) || 0;
    const bazinYield = parseFloat(document.getElementById('bazinYield').value) || 6;
    const bazinResult = calculateBazin(bazinDPA, bazinYield);
    displayResult('bazin', bazinResult, currentPrice);

    // P/L Justo
    const plLPA = parseFloat(document.getElementById('plLPA').value) || 0;
    const plJusto = parseFloat(document.getElementById('plJusto').value) || 15;
    const plResult = calculatePL(plLPA, plJusto);
    displayResult('pl', plResult, currentPrice);

    // Gordon
    const gordonDPA = parseFloat(document.getElementById('gordonDPA').value) || 0;
    const gordonK = parseFloat(document.getElementById('gordonK').value) || 12;
    const gordonG = parseFloat(document.getElementById('gordonG').value) || 3;
    const gordonResult = calculateGordon(gordonDPA, gordonK, gordonG);
    displayResult('gordon', gordonResult, currentPrice);

    // Resumo
    displaySummary(currentPrice, [grahamResult, bazinResult, plResult, gordonResult]);
}

// Fórmula de Graham
function calculateGraham(lpa, vpa) {
    if (lpa <= 0 || vpa <= 0) return null;
    return Math.sqrt(22.5 * lpa * vpa);
}

// Método Bazin
function calculateBazin(dpa, minYield) {
    if (dpa <= 0 || minYield <= 0) return null;
    return dpa / (minYield / 100);
}

// P/L Justo
function calculatePL(lpa, plJusto) {
    if (lpa <= 0) return null;
    return lpa * plJusto;
}

// Modelo de Gordon
function calculateGordon(dpa, k, g) {
    if (dpa <= 0 || k <= g) return null;
    return dpa / ((k - g) / 100);
}

// Exibe resultado de cada método
function displayResult(method, fairPrice, currentPrice) {
    const resultEl = document.getElementById(`${method}Result`);
    const upsideEl = document.getElementById(`${method}Upside`);

    if (fairPrice === null || isNaN(fairPrice) || !isFinite(fairPrice)) {
        resultEl.textContent = 'N/A';
        upsideEl.textContent = '';
        upsideEl.className = 'result-upside';
        return;
    }

    resultEl.textContent = `R$ ${fairPrice.toFixed(2)}`;

    const upside = ((fairPrice - currentPrice) / currentPrice) * 100;
    const sign = upside >= 0 ? '+' : '';
    upsideEl.textContent = `${sign}${upside.toFixed(1)}%`;
    upsideEl.className = `result-upside ${upside >= 0 ? 'positive' : 'negative'}`;
}

// Exibe resumo do valuation
function displaySummary(currentPrice, fairPrices) {
    // Filtra valores válidos
    const validPrices = fairPrices.filter(p => p !== null && !isNaN(p) && isFinite(p));

    if (validPrices.length === 0) {
        document.getElementById('valuationSummary').style.display = 'none';
        return;
    }

    document.getElementById('valuationSummary').style.display = 'block';

    // Preço justo médio
    const avgFairPrice = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;

    // Potencial de valorização
    const upside = ((avgFairPrice - currentPrice) / currentPrice) * 100;

    // Exibe valores
    document.getElementById('summaryCurrentPrice').textContent = `R$ ${currentPrice.toFixed(2)}`;
    document.getElementById('summaryFairPrice').textContent = `R$ ${avgFairPrice.toFixed(2)}`;

    const sign = upside >= 0 ? '+' : '';
    const upsideEl = document.getElementById('summaryUpside');
    upsideEl.textContent = `${sign}${upside.toFixed(1)}%`;
    upsideEl.className = `summary-value ${upside >= 0 ? 'positive' : 'negative'}`;

    // Recomendação
    const recommendationEl = document.getElementById('summaryRecommendation');
    let recommendation, recClass;

    if (upside > 30) {
        recommendation = 'COMPRA FORTE';
        recClass = 'strong-buy';
    } else if (upside > 10) {
        recommendation = 'COMPRA';
        recClass = 'buy';
    } else if (upside > -10) {
        recommendation = 'NEUTRO';
        recClass = 'neutral';
    } else if (upside > -30) {
        recommendation = 'VENDA';
        recClass = 'sell';
    } else {
        recommendation = 'VENDA FORTE';
        recClass = 'strong-sell';
    }

    recommendationEl.textContent = recommendation;
    recommendationEl.className = `summary-value recommendation ${recClass}`;

    // Gráfico
    renderValuationChart(currentPrice, fairPrices, avgFairPrice);
}

// Renderiza gráfico de valuation
function renderValuationChart(currentPrice, fairPrices, avgFairPrice) {
    const ctx = document.getElementById('valuationChart').getContext('2d');

    if (valuationChart) {
        valuationChart.destroy();
    }

    const labels = ['Graham', 'Bazin', 'P/L Justo', 'Gordon', 'Média', 'Atual'];
    const values = [...fairPrices.map(p => p || 0), avgFairPrice, currentPrice];

    const colors = fairPrices.map(p => {
        if (!p) return 'rgba(100, 100, 100, 0.6)';
        return p > currentPrice ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
    });
    colors.push('rgba(99, 102, 241, 0.8)'); // Média
    colors.push('rgba(234, 179, 8, 0.8)'); // Atual

    const borderColors = fairPrices.map(p => {
        if (!p) return 'rgba(100, 100, 100, 1)';
        return p > currentPrice ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
    });
    borderColors.push('rgba(99, 102, 241, 1)');
    borderColors.push('rgba(234, 179, 8, 1)');

    valuationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Preço (R$)',
                data: values,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `R$ ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
}
