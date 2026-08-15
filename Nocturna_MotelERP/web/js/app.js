class Usuario {
  constructor(id, nombre, email, rol, password) {
    this.id = id;
    this.nombre = nombre;
    this.email = email;
    this.rol = rol;
    this.password = password;
  }
  getId() { return this.id; }
  getNombre() { return this.nombre; }
  getEmail() { return this.email; }
  getRol() { return this.rol; }
  setNombre(nombre) { this.nombre = nombre; }
  setRol(rol) { this.rol = rol; }
  puedeFacturar() { return ["Administrador", "Recepcionista"].includes(this.rol); }
  puedeReponer() { return ["Administrador", "Bodega"].includes(this.rol); }
}

class Producto {
  constructor(id, codigo, nombre, categoria, stock, stockMinimo, precioVenta) {
    this.id = id;
    this.codigo = codigo;
    this.nombre = nombre;
    this.categoria = categoria;
    this.stock = stock;
    this.stockMinimo = stockMinimo;
    this.precioVenta = precioVenta;
  }
  getId() { return this.id; }
  getCodigo() { return this.codigo; }
  getNombre() { return this.nombre; }
  getCategoria() { return this.categoria; }
  getStock() { return this.stock; }
  getStockMinimo() { return this.stockMinimo; }
  getPrecioVenta() { return this.precioVenta; }
  setStock(stock) {
    if (stock < 0) throw new Error("El stock no puede ser negativo");
    this.stock = stock;
  }
  necesitaReposicion() { return this.stock <= this.stockMinimo; }
  descontar(cantidad) {
    if (cantidad <= 0) throw new Error("Cantidad inválida");
    if (cantidad > this.stock) throw new Error("Stock insuficiente para " + this.nombre);
    this.stock -= cantidad;
  }
  ingresar(cantidad) {
    if (cantidad <= 0) throw new Error("Cantidad inválida");
    this.stock += cantidad;
  }
}

class Factura {
  constructor(id, usuario, cliente = "Cliente mostrador") {
    this.id = id;
    this.usuario = usuario;
    this.cliente = cliente;
    this.detalles = [];
    this.fecha = new Date();
  }
  agregarProducto(producto, cantidad) {
    producto.descontar(cantidad);
    const existente = this.detalles.find((d) => d.producto.getId() === producto.getId());
    if (existente) {
      existente.cantidad += cantidad;
      existente.total = existente.unitario * existente.cantidad;
      return;
    }
    this.detalles.push({
      producto,
      cantidad,
      unitario: producto.getPrecioVenta(),
      total: producto.getPrecioVenta() * cantidad
    });
  }
  getSubtotal() { return this.detalles.reduce((sum, item) => sum + item.total, 0); }
  getImpuesto() { return Math.round(this.getSubtotal() * 0.19); }
  getTotal() { return this.getSubtotal() + this.getImpuesto(); }
}

class Inventario {
  constructor(productos = []) {
    this.productos = productos;
    this.movimientos = [];
  }
  listar() { return this.productos; }
  catalogoVenta() {
    return this.productos.filter((p) => p.getCategoria() !== "Habitación");
  }
  buscarPorId(id) { return this.productos.find((p) => p.id === Number(id)); }
  registrarMovimiento(tipo, producto, cantidad, anterior, usuario) {
    this.movimientos.unshift({
      tipo,
      producto: producto.getNombre(),
      cantidad: Number(cantidad),
      anterior,
      nuevo: producto.getStock(),
      usuario: usuario.getEmail(),
      fecha: new Date().toLocaleString("es-CO")
    });
  }
  registrarIngreso(productoId, cantidad, usuario) {
    const producto = this.buscarPorId(productoId);
    if (!producto) throw new Error("Producto no encontrado");
    const anterior = producto.getStock();
    producto.ingresar(Number(cantidad));
    this.registrarMovimiento("INGRESO", producto, cantidad, anterior, usuario);
    return producto;
  }
}

const usuarios = [
  new Usuario(1, "Laura Admin", "admin@motelerp.local", "Administrador", "demo123"),
  new Usuario(2, "Carlos Recepción", "recepcion@motelerp.local", "Recepcionista", "demo123"),
  new Usuario(3, "Marta Bodega", "bodega@motelerp.local", "Bodega", "demo123")
];

const inventario = new Inventario([
  new Producto(1, "MIN-001", "Cerveza artesanal", "Minibar", 12, 4, 8000),
  new Producto(2, "MIN-002", "Vino tinto copa", "Minibar", 8, 3, 18000),
  new Producto(3, "MIN-003", "Snack mixto", "Minibar", 20, 6, 6500),
  new Producto(4, "ASE-001", "Kit de aseo", "Aseo", 15, 5, 8000),
  new Producto(5, "LEN-001", "Toalla estándar", "Lencería", 18, 5, 12000),
  new Producto(6, "LEN-002", "Sábanas premium", "Lencería", 6, 3, 28000),
  new Producto(7, "HAB-001", "Turno Estándar", "Habitación", 10, 1, 85000),
  new Producto(8, "HAB-002", "Turno Suite Jacuzzi", "Habitación", 6, 1, 145000),
  new Producto(9, "HAB-003", "Turno VIP Terraza", "Habitación", 4, 1, 190000)
]);

let sesion = null;
let facturaActual = null;
let facturaSeq = 1;
let ultimoTotal = 0;

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

function setMsg(id, text, ok) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `message ${ok ? "ok" : text ? "bad" : ""}`;
}

function exigirSesion(accion) {
  if (!sesion) throw new Error("Inicie sesión antes de " + accion + ".");
}

function catClass(categoria) {
  const map = { Minibar: "minibar", Aseo: "aseo", Lencería: "lenceria", Habitación: "habitacion" };
  return map[categoria] || "minibar";
}

function agregarCargo(productoId, cantidad) {
  exigirSesion("facturar");
  if (!sesion.puedeFacturar()) throw new Error("El rol " + sesion.getRol() + " no puede emitir facturas.");
  const producto = inventario.buscarPorId(productoId);
  if (!producto) throw new Error("Producto no encontrado");
  const cliente = document.getElementById("cliente").value.trim() || "Cliente mostrador";
  if (!facturaActual) facturaActual = new Factura(facturaSeq++, sesion, cliente);
  const anterior = producto.getStock();
  facturaActual.agregarProducto(producto, Number(cantidad));
  inventario.registrarMovimiento("VENTA", producto, cantidad, anterior, sesion);
  ultimoTotal = facturaActual.getTotal();
  setMsg("movementMsg", producto.getNombre() + " agregado a la factura.", true);
  render();
  renderInvoice();
}

function render() {
  const cards = document.getElementById("productCards");
  const rows = document.getElementById("inventoryRows");
  const select = document.getElementById("productSelect");
  const log = document.getElementById("movementLog");
  const selected = select.value;
  cards.innerHTML = "";
  rows.innerHTML = "";
  select.innerHTML = "";
  log.innerHTML = "";

  inventario.catalogoVenta().forEach((p) => {
    const pct = Math.min(100, Math.round((p.getStock() / Math.max(p.getStockMinimo() * 3, 1)) * 100));
    cards.insertAdjacentHTML("beforeend", `
      <article class="product-card">
        <div class="product-media ${catClass(p.getCategoria())}">
          <span class="badge">${p.getCategoria()}</span>
        </div>
        <div class="body">
          <strong>${p.getNombre()}</strong>
          <span class="price">${money(p.getPrecioVenta())}</span>
          <span>Stock ${p.getStock()} · mínimo ${p.getStockMinimo()}</span>
          <div class="stock-bar ${p.necesitaReposicion() ? "low" : ""}"><span style="width:${pct}%"></span></div>
          <button type="button" class="ghost dark" data-add="${p.getId()}">Agregar a factura</button>
        </div>
      </article>
    `);
  });

  inventario.listar().forEach((p) => {
    rows.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${p.getCodigo()}</td>
        <td>${p.getNombre()}</td>
        <td>${p.getCategoria()}</td>
        <td>${p.getStock()}</td>
        <td>${p.getStockMinimo()}</td>
        <td class="${p.necesitaReposicion() ? "state-bad" : "state-ok"}">
          ${p.necesitaReposicion() ? "Reposición" : "OK"}
        </td>
      </tr>
    `);
    select.insertAdjacentHTML("beforeend", `<option value="${p.getId()}">${p.getNombre()}</option>`);
  });
  if (selected) select.value = selected;

  if (inventario.movimientos.length === 0) {
    log.innerHTML = "<li><span>Sin movimientos todavía.</span></li>";
  } else {
    inventario.movimientos.slice(0, 10).forEach((m) => {
      log.insertAdjacentHTML("beforeend", `<li><span>${m.fecha} · ${m.tipo} · ${m.producto} ×${m.cantidad}</span><span>${m.anterior} → ${m.nuevo}</span></li>`);
    });
  }

  const units = inventario.listar().reduce((s, p) => s + p.getStock(), 0);
  const alerts = inventario.listar().filter((p) => p.necesitaReposicion()).length;
  document.getElementById("totalProducts").textContent = inventario.listar().length;
  document.getElementById("stockUnits").textContent = units;
  document.getElementById("criticalCount").textContent = alerts;
  document.getElementById("heroProducts").textContent = inventario.listar().length;
  document.getElementById("heroUnits").textContent = units;
  document.getElementById("heroAlerts").textContent = alerts;
  document.getElementById("heroInvoice").textContent = money(ultimoTotal);
  document.getElementById("invoiceTotal").textContent = money(facturaActual ? facturaActual.getTotal() : ultimoTotal);

  const chip = document.getElementById("sessionChip");
  chip.textContent = sesion ? `${sesion.getNombre()} · ${sesion.getRol()}` : "Sin sesión";
  document.getElementById("heroHint").textContent = sesion
    ? `Sesión: ${sesion.getRol()}. Facturar: ${sesion.puedeFacturar() ? "sí" : "no"}. Reponer: ${sesion.puedeReponer() ? "sí" : "no"}.`
    : "Inicie sesión para mover inventario y emitir cargos.";
  document.getElementById("erpWrap").classList.toggle("locked", !sesion);
}

function renderInvoice() {
  const lines = document.getElementById("invoiceLines");
  lines.innerHTML = "";
  if (!facturaActual || facturaActual.detalles.length === 0) {
    document.getElementById("invoiceMeta").textContent = "Sin cargos.";
    document.getElementById("invSub").textContent = money(0);
    document.getElementById("invIva").textContent = money(0);
    document.getElementById("invGrand").textContent = money(0);
    return;
  }
  document.getElementById("invoiceMeta").textContent =
    `Factura ${String(facturaActual.id).padStart(4, "0")} · ${facturaActual.cliente} · ${facturaActual.usuario.getNombre()}`;
  facturaActual.detalles.forEach((d) => {
    lines.insertAdjacentHTML("beforeend", `<li><span>${d.producto.getNombre()} × ${d.cantidad}</span><span>${money(d.total)}</span></li>`);
  });
  document.getElementById("invSub").textContent = money(facturaActual.getSubtotal());
  document.getElementById("invIva").textContent = money(facturaActual.getImpuesto());
  document.getElementById("invGrand").textContent = money(facturaActual.getTotal());
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const user = usuarios.find((u) => u.getEmail() === email && u.password === password);
  if (!user) {
    sesion = null;
    setMsg("loginMsg", "Credenciales inválidas.", false);
    render();
    return;
  }
  sesion = user;
  setMsg("loginMsg", `Acceso concedido: ${user.getNombre()} (${user.getRol()}).`, true);
  render();
  document.getElementById("erp").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  sesion = null;
  facturaActual = null;
  setMsg("loginMsg", "Sesión cerrada.", true);
  setMsg("movementMsg", "", true);
  render();
  renderInvoice();
});

document.querySelectorAll(".account").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("email").value = btn.dataset.email;
    document.getElementById("password").value = btn.dataset.pass;
  });
});

document.getElementById("invoiceForm").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    agregarCargo(document.getElementById("productSelect").value, document.getElementById("quantity").value);
  } catch (err) {
    setMsg("movementMsg", err.message, false);
  }
});

document.getElementById("restockBtn").addEventListener("click", () => {
  try {
    exigirSesion("reponer inventario");
    if (!sesion.puedeReponer()) throw new Error("Solo Administrador o Bodega pueden ingresar mercancía.");
    inventario.registrarIngreso(document.getElementById("productSelect").value, 5, sesion);
    setMsg("movementMsg", "Ingreso de +5 unidades registrado.", true);
    render();
  } catch (err) {
    setMsg("movementMsg", err.message, false);
  }
});

document.getElementById("newInvoiceBtn").addEventListener("click", () => {
  try {
    exigirSesion("abrir una factura");
    if (!sesion.puedeFacturar()) throw new Error("Este rol no puede abrir facturas.");
    facturaActual = null;
    setMsg("movementMsg", "Nueva factura lista. Agregue el primer cargo.", true);
    renderInvoice();
    render();
  } catch (err) {
    setMsg("movementMsg", err.message, false);
  }
});

document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  try {
    agregarCargo(btn.dataset.add, 1);
    document.getElementById("erp").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    setMsg("movementMsg", err.message, false);
    document.getElementById("erp").scrollIntoView({ behavior: "smooth" });
  }
});

document.getElementById("navToggle").addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("open");
});

render();
renderInvoice();
