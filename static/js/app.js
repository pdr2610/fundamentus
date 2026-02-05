// Estado global da aplicação
const state = {
    stocks: {},
    selectedTicker: null,
    comparisonList: [],
    filteredTickers: []
};

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

// Renderizar lista de ações
function renderStockList() {
    const listEl = document.getElementById('stockList');

    if (state.filteredTickers.length === 0) {
        listEl.innerHTML = '<div class="loading">Nenhuma empresa encontrada</div>';
        return;
    }

    listEl.innerHTML = state.filteredTickers.map(ticker => {
        const stock = state.stocks[ticker];
        const isSelected = state.selectedTicker === ticker;
        const isInComparison = state.comparisonList.includes(ticker);

        return `
            <div class="stock-item ${isSelected ? 'selected' : ''}" data-ticker="${ticker}">
                <input type="checkbox" class="checkbox"
                    ${isInComparison ? 'checked' : ''}
                    onclick="event.stopPropagation(); toggleComparison('${ticker}')">
                <span class="ticker">${ticker}</span>
                <span class="price">R$ ${stock.Cotacao.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    }).join('');

    // Adicionar eventos de clique
    listEl.querySelectorAll('.stock-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                selectStock(item.dataset.ticker);
            }
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

// Limpar comparação
function clearComparison() {
    state.comparisonList = [];
    renderStockList();
    renderComparison();
}

// Filtrar ações
function filterStocks(searchTerm) {
    const term = searchTerm.toUpperCase().trim();

    if (term === '') {
        state.filteredTickers = Object.keys(state.stocks).sort();
    } else {
        state.filteredTickers = Object.keys(state.stocks)
            .filter(ticker => ticker.includes(term))
            .sort();
    }

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
});
