-- Schema for Finance App Database (Cloudflare D1)

-- Categories table
DROP TABLE IF EXISTS categorias;
CREATE TABLE categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_categoria TEXT NOT NULL
);

-- Subcategories table
DROP TABLE IF EXISTS subcategorias;
CREATE TABLE subcategorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_categoria INTEGER NOT NULL,
    nome_subcategoria TEXT NOT NULL,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id)
);

-- Items table
DROP TABLE IF EXISTS itens;
CREATE TABLE itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_subcategoria INTEGER NOT NULL,
    nome_item TEXT NOT NULL,
    FOREIGN KEY (id_subcategoria) REFERENCES subcategorias(id)
);


DROP TABLE IF EXISTS gastos;

CREATE TABLE gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER,          -- Adicionado para agrupar itens da mesma compra
    data TEXT NOT NULL,         -- Renomeado de data_compra para data
    valor REAL NOT NULL,
    parcelas INTEGER,
    id_item INTEGER NOT NULL,
    id_categoria INTEGER NOT NULL,
    id_subcategoria INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('fixo', 'variável')),
    pagamento TEXT NOT NULL CHECK (pagamento IN ('Crédito', 'Pix', 'Dinheiro', 'Débito')),
    comentario TEXT,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id),
    FOREIGN KEY (id_subcategoria) REFERENCES subcategorias(id),
    FOREIGN KEY (id_item) REFERENCES itens(id)
);

-- Fixed expenses table
DROP TABLE IF EXISTS gastos_fixos;
CREATE TABLE gastos_fixos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valor REAL NOT NULL,
    id_categoria INTEGER NOT NULL,
    id_subcategoria INTEGER NOT NULL,
    id_item INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('fixo', 'variável')),
    pagamento TEXT NOT NULL CHECK (pagamento IN ('Crédito', 'Pix', 'Dinheiro', 'Débito')),
    comentario TEXT,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id),
    FOREIGN KEY (id_subcategoria) REFERENCES subcategorias(id),
    FOREIGN KEY (id_item) REFERENCES itens(id)
);
