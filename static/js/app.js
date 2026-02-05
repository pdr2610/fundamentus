// Estado global da aplicação
const state = {
    stocks: {},
    selectedTicker: null,
    comparisonList: [],
    filteredTickers: [],
    sortBy: 'ticker',
    sortOrder: 'asc',
    filters: {}
};

// Instâncias dos gráficos
let barChartInstance = null;
let radarChartInstance = null;

// Configuração dos indicadores com descrições
const indicatorConfig = {
    'Cotacao': { label: 'Cotação', format: 'currency', category: 'price' },
    'P/L': { label: 'P/L', format: 'decimal', category: 'valuation' },
    'P/VP': { label: 'P/VP', format: 'decimal', category: 'valuation' },
    'PSR': { label: 'PSR', format: 'decimal', category: 'valuation' },
    'DY': { label: 'Dividend Yield', format: 'percent', category: 'valuation' },
    'P/Ativo': { label: 'P/Ativo', format: 'decimal', category: 'valuation' },
    'P/Cap.Giro': { label: 'P/Cap.Giro', format: 'decimal', category: 'valuation' },
    'P/EBIT': { label: 'P/EBIT', format: 'decimal', category: 'valuation' },
    'P/ACL': { label: 'P/ACL', format: 'decimal', category: 'valuation' },
    'EV/EBIT': { label: 'EV/EBIT', format: 'decimal', category: 'valuation' },
    'EV/EBITDA': { label: 'EV/EBITDA', format: 'decimal', category: 'valuation' },
    'Mrg.Ebit': { label: 'Margem EBIT', format: 'percent', category: 'margins' },
    'Mrg.Liq.': { label: 'Margem Líquida', format: 'percent', category: 'margins' },
    'Liq.Corr.': { label: 'Liquidez Corrente', format: 'decimal', category: 'financial' },
    'ROIC': { label: 'ROIC', format: 'percent', category: 'returns' },
    'ROE': { label: 'ROE', format: 'percent', category: 'returns' },
    'Liq.2meses': { label: 'Liquidez 2 meses', format: 'number', category: 'liquidity' },
    'Pat.Liq': { label: 'Patrimônio Líquido', format: 'number', category: 'financial' },
    'Div.Brut/Pat.': { label: 'Dív.Bruta/Patrim.', format: 'decimal', category: 'debt' },
    'Cresc.5anos': { label: 'Cresc. 5 anos', format: 'percent', category: 'growth' }
};

// Cores para os gráficos
const chartColors = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
    '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5'
];

// Funções de formatação
function formatValue(value, format) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }

    switch (format) {
        case 'currency':
            return `R$ ${value.toFixed(2).replace('.', ',')}`;
        case 'percent':
            return `${(value * 100).toFixed(2).replace('.', ',')}%`;
        case 'decimal':
            return value.toFixed(2).replace('.', ',');
        case 'number':
            return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
        default:
            return value.toString();
    }
}

function getValueClass(value, key) {
    if (key === 'DY' || key === 'ROIC' || key === 'ROE' || key === 'Mrg.Ebit' || key === 'Mrg.Liq.' || key === 'Cresc.5anos') {
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
    }
    return '';
}

// Carregar dados da API
async function loadStocks() {
    try {
        const response = await fetch('/api/stocks');
        if (!response.ok) throw new Error('Erro ao carregar dados');

        state.stocks = await response.json();
        state.filteredTickers = Object.keys(state.stocks).sort();

        renderStockList();
        updateStockCount();
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('stockList').innerHTML = `
            <div class="loading">Erro ao carregar dados. Tente novamente.</div>
        `;
    }
}

// Ordenar tickers
function sortTickers(tickers) {
    return tickers.sort((a, b) => {
        let valueA, valueB;

        if (state.sortBy === 'ticker') {
            valueA = a;
            valueB = b;
        } else {
            valueA = state.stocks[a][state.sortBy];
            valueB = state.stocks[b][state.sortBy];

            // Tratar valores nulos/undefined
            if (valueA === null || valueA === undefined || isNaN(valueA)) valueA = state.sortOrder === 'asc' ? Infinity : -Infinity;
            if (valueB === null || valueB === undefined || isNaN(valueB)) valueB = state.sortOrder === 'asc' ? Infinity : -Infinity;
        }

        if (state.sortOrder === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
}

// Aplicar filtros avançados
function applyAdvancedFilters(tickers) {
    return tickers.filter(ticker => {
        const stock = state.stocks[ticker];

        // P/L
        const plMin = parseFloat(document.getElementById('plMin').value);
        const plMax = parseFloat(document.getElementById('plMax').value);
        if (!isNaN(plMin) && stock['P/L'] < plMin) return false;
        if (!isNaN(plMax) && stock['P/L'] > plMax) return false;

        // P/VP
        const pvpMin = parseFloat(document.getElementById('pvpMin').value);
        const pvpMax = parseFloat(document.getElementById('pvpMax').value);
        if (!isNaN(pvpMin) && stock['P/VP'] < pvpMin) return false;
        if (!isNaN(pvpMax) && stock['P/VP'] > pvpMax) return false;

        // DY (converter de % para decimal)
        const dyMin = parseFloat(document.getElementById('dyMin').value);
        const dyMax = parseFloat(document.getElementById('dyMax').value);
        if (!isNaN(dyMin) && stock['DY'] * 100 < dyMin) return false;
        if (!isNaN(dyMax) && stock['DY'] * 100 > dyMax) return false;

        // ROE (converter de % para decimal)
        const roeMin = parseFloat(document.getElementById('roeMin').value);
        const roeMax = parseFloat(document.getElementById('roeMax').value);
        if (!isNaN(roeMin) && stock['ROE'] * 100 < roeMin) return false;
        if (!isNaN(roeMax) && stock['ROE'] * 100 > roeMax) return false;

        // ROIC (converter de % para decimal)
        const roicMin = parseFloat(document.getElementById('roicMin').value);
        const roicMax = parseFloat(document.getElementById('roicMax').value);
        if (!isNaN(roicMin) && stock['ROIC'] * 100 < roicMin) return false;
        if (!isNaN(roicMax) && stock['ROIC'] * 100 > roicMax) return false;

        // Margem Líquida (converter de % para decimal)
        const margemMin = parseFloat(document.getElementById('margemMin').value);
        const margemMax = parseFloat(document.getElementById('margemMax').value);
        if (!isNaN(margemMin) && stock['Mrg.Liq.'] * 100 < margemMin) return false;
        if (!isNaN(margemMax) && stock['Mrg.Liq.'] * 100 > margemMax) return false;

        // Liquidez Corrente
        const liqCorrMin = parseFloat(document.getElementById('liqCorrMin').value);
        const liqCorrMax = parseFloat(document.getElementById('liqCorrMax').value);
        if (!isNaN(liqCorrMin) && stock['Liq.Corr.'] < liqCorrMin) return false;
        if (!isNaN(liqCorrMax) && stock['Liq.Corr.'] > liqCorrMax) return false;

        // Dív.Bruta/Patrim.
        const divBrutaMin = parseFloat(document.getElementById('divBrutaMin').value);
        const divBrutaMax = parseFloat(document.getElementById('divBrutaMax').value);
        if (!isNaN(divBrutaMin) && stock['Div.Brut/Pat.'] < divBrutaMin) return false;
        if (!isNaN(divBrutaMax) && stock['Div.Brut/Pat.'] > divBrutaMax) return false;

        return true;
    });
}

// Renderizar lista de ações
function renderStockList() {
    const listEl = document.getElementById('stockList');

    if (state.filteredTickers.length === 0) {
        listEl.innerHTML = '<div class="loading">Nenhuma empresa encontrada</div>';
        return;
    }

    // Aplicar ordenação
    const sortedTickers = sortTickers([...state.filteredTickers]);

    listEl.innerHTML = sortedTickers.map(ticker => {
        const stock = state.stocks[ticker];
        const isSelected = state.selectedTicker === ticker;
        const isInComparison = state.comparisonList.includes(ticker);

        return `
            <div class="stock-item ${isSelected ? 'selected' : ''} ${isInComparison ? 'in-comparison' : ''}" data-ticker="${ticker}">
                <input type="checkbox" class="checkbox"
                    ${isInComparison ? 'checked' : ''}>
                <span class="ticker">${ticker}</span>
                <span class="price">R$ ${stock.Cotacao.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    }).join('');

    // Adicionar eventos de clique
    listEl.querySelectorAll('.stock-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const ticker = item.dataset.ticker;
            // Sempre seleciona a empresa e mostra detalhes
            selectStock(ticker);
            // Também marca/desmarca o checkbox
            toggleComparison(ticker);
        });
    });
}

// Selecionar uma ação
function selectStock(ticker) {
    state.selectedTicker = ticker;
    renderStockList();
    renderStockDetails(ticker);
}

// Renderizar detalhes da ação
function renderStockDetails(ticker) {
    const detailsEl = document.getElementById('stockDetails');
    const stock = state.stocks[ticker];

    if (!stock) {
        detailsEl.innerHTML = '<div class="placeholder"><p>Ação não encontrada</p></div>';
        return;
    }

    const indicatorsHTML = Object.entries(indicatorConfig)
        .filter(([key]) => key !== 'Cotacao')
        .map(([key, config]) => {
            const value = stock[key];
            const valueClass = getValueClass(value, key);
            return `
                <div class="indicator-card">
                    <div class="label">${config.label}</div>
                    <div class="value ${valueClass}">${formatValue(value, config.format)}</div>
                </div>
            `;
        }).join('');

    detailsEl.innerHTML = `
        <div class="detail-header">
            <span class="ticker-name">${ticker}</span>
            <span class="current-price">${formatValue(stock.Cotacao, 'currency')}</span>
        </div>
        <div class="indicators-grid">
            ${indicatorsHTML}
        </div>
    `;
}

// Toggle comparação
function toggleComparison(ticker) {
    const index = state.comparisonList.indexOf(ticker);

    if (index === -1) {
        state.comparisonList.push(ticker);
    } else {
        state.comparisonList.splice(index, 1);
    }

    renderStockList();
    renderComparison();
    renderCharts();
}

// Renderizar tabela de comparação
function renderComparison() {
    const section = document.getElementById('comparisonSection');
    const headEl = document.getElementById('comparisonHead');
    const bodyEl = document.getElementById('comparisonBody');

    if (state.comparisonList.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Cabeçalho
    headEl.innerHTML = `
        <tr>
            <th>Indicador</th>
            ${state.comparisonList.map(ticker => `<th class="ticker-header">${ticker}</th>`).join('')}
        </tr>
    `;

    // Corpo
    bodyEl.innerHTML = Object.entries(indicatorConfig).map(([key, config]) => {
        return `
            <tr>
                <td><strong>${config.label}</strong></td>
                ${state.comparisonList.map(ticker => {
                    const value = state.stocks[ticker][key];
                    const valueClass = getValueClass(value, key);
                    return `<td class="${valueClass}">${formatValue(value, config.format)}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');
}

// Renderizar gráficos
function renderCharts() {
    const chartsSection = document.getElementById('chartsSection');

    if (state.comparisonList.length < 2) {
        chartsSection.style.display = 'none';
        return;
    }

    chartsSection.style.display = 'block';

    const selectedIndicator = document.getElementById('chartIndicator').value;
    const config = indicatorConfig[selectedIndicator];

    // Preparar dados
    const labels = state.comparisonList;
    const data = state.comparisonList.map(ticker => {
        let value = state.stocks[ticker][selectedIndicator];
        // Converter percentuais para exibição
        if (config.format === 'percent') {
            value = value * 100;
        }
        return value;
    });

    // Gráfico de barras
    renderBarChart(labels, data, config);

    // Gráfico radar
    renderRadarChart();
}

// Gráfico de barras
function renderBarChart(labels, data, config) {
    const ctx = document.getElementById('barChart').getContext('2d');

    if (barChartInstance) {
        barChartInstance.destroy();
    }

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: config.label,
                data: data,
                backgroundColor: labels.map((_, i) => chartColors[i % chartColors.length]),
                borderColor: labels.map((_, i) => chartColors[i % chartColors.length]),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Comparativo: ${config.label}`
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (config.format === 'percent') {
                                return value.toFixed(2) + '%';
                            } else if (config.format === 'currency') {
                                return 'R$ ' + value.toFixed(2);
                            }
                            return value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// Gráfico radar
function renderRadarChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');

    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    // Indicadores para o radar (normalizados)
    const radarIndicators = ['P/L', 'P/VP', 'DY', 'ROE', 'ROIC', 'Mrg.Liq.'];
    const radarLabels = radarIndicators.map(key => indicatorConfig[key].label);

    // Normalizar valores (0-100)
    const normalizeValues = (indicator) => {
        const values = state.comparisonList.map(ticker => state.stocks[ticker][indicator]);
        const min = Math.min(...values.filter(v => !isNaN(v)));
        const max = Math.max(...values.filter(v => !isNaN(v)));
        const range = max - min || 1;

        return state.comparisonList.map(ticker => {
            const value = state.stocks[ticker][indicator];
            if (isNaN(value)) return 0;
            return ((value - min) / range) * 100;
        });
    };

    const datasets = state.comparisonList.map((ticker, index) => {
        const data = radarIndicators.map(indicator => {
            const normalized = normalizeValues(indicator);
            return normalized[index];
        });

        return {
            label: ticker,
            data: data,
            backgroundColor: chartColors[index % chartColors.length] + '33',
            borderColor: chartColors[index % chartColors.length],
            borderWidth: 2,
            pointBackgroundColor: chartColors[index % chartColors.length]
        };
    });

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: radarLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Comparativo Geral (Normalizado)'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Limpar comparação
function clearComparison() {
    state.comparisonList = [];
    renderStockList();
    renderComparison();
    renderCharts();
}

// Filtrar ações
function filterStocks(searchTerm) {
    const term = searchTerm.toUpperCase().trim();

    let tickers = Object.keys(state.stocks);

    // Aplicar filtro de busca
    if (term !== '') {
        tickers = tickers.filter(ticker => ticker.includes(term));
    }

    // Aplicar filtros avançados
    tickers = applyAdvancedFilters(tickers);

    state.filteredTickers = tickers;

    renderStockList();
    updateStockCount();
}

// Atualizar contador
function updateStockCount() {
    const total = Object.keys(state.stocks).length;
    const filtered = state.filteredTickers.length;
    const countEl = document.getElementById('stockCount');

    if (filtered === total) {
        countEl.textContent = `${total} empresas disponíveis`;
    } else {
        countEl.textContent = `${filtered} de ${total} empresas`;
    }
}

// Limpar filtros
function clearFilters() {
    document.getElementById('plMin').value = '';
    document.getElementById('plMax').value = '';
    document.getElementById('pvpMin').value = '';
    document.getElementById('pvpMax').value = '';
    document.getElementById('dyMin').value = '';
    document.getElementById('dyMax').value = '';
    document.getElementById('roeMin').value = '';
    document.getElementById('roeMax').value = '';
    document.getElementById('roicMin').value = '';
    document.getElementById('roicMax').value = '';
    document.getElementById('margemMin').value = '';
    document.getElementById('margemMax').value = '';
    document.getElementById('liqCorrMin').value = '';
    document.getElementById('liqCorrMax').value = '';
    document.getElementById('divBrutaMin').value = '';
    document.getElementById('divBrutaMax').value = '';

    filterStocks(document.getElementById('searchInput').value);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadStocks();

    // Busca
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    searchInput.addEventListener('input', (e) => {
        filterStocks(e.target.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            filterStocks(e.target.value);
        }
    });

    searchBtn.addEventListener('click', () => {
        filterStocks(searchInput.value);
    });

    // Limpar comparação
    document.getElementById('clearComparison').addEventListener('click', clearComparison);

    // Toggle filtros
    document.getElementById('toggleFilters').addEventListener('click', () => {
        const content = document.getElementById('filtersContent');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    // Aplicar filtros
    document.getElementById('applyFilters').addEventListener('click', () => {
        filterStocks(searchInput.value);
    });

    // Limpar filtros
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    // Ordenação
    document.getElementById('sortIndicator').addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderStockList();
    });

    document.getElementById('sortOrder').addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        renderStockList();
    });

    // Seletor de indicador do gráfico
    document.getElementById('chartIndicator').addEventListener('change', () => {
        renderCharts();
    });
});
