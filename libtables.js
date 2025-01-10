/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Libtables4: framework for building web-applications on relational databases *
 * Version 4.0.0-alpha / Copyright (C) 2024  Bart Noordervliet, MMVI           *
 *                                                                             *
 * This program is free software: you can redistribute it and/or modify        *
 * it under the terms of the GNU Affero General Public License as              *
 * published by the Free Software Foundation, either version 3 of the          *
 * License, or (at your option) any later version.                             *
 *                                                                             *
 * This program is distributed in the hope that it will be useful,             *
 * but WITHOUT ANY WARRANTY; without even the implied warranty of              *
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the               *
 * GNU Affero General Public License for more details.                         *
 *                                                                             *
 * You should have received a copy of the GNU Affero General Public License    *
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Notes on variable names:                                        *
 *                                                                 *
 *   tbl   = Libtables cached table data                           *
 *   r     = table row iterator                                    *
 *   c     = table column iterator                                 *
 *   i, j  = generic iterators                                     *
 *   attr  = jQuery object built from HTML5 "data-" attributes     *
 *   table, thead, tbody, tfoot, row, cell                         *
 *         = jQuery object wrapping the corresponding DOM element  *
 *   data  = object parsed from server JSON response               *
 *   src   = unique identifier string for the table                *
 *           composed of <block>:<tag>                             *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

'use strict';
let tab = '-';
let ajaxUrl = "libtables-api.php";
let tables = {};
let lists = {};
let transl = {};
let lang = 0;
let $ = jQuery;

$(document).ready(function() {
  if (!sessionStorage.getItem('libtables_tabid')) {
    tab = generateId(6);
    sessionStorage.setItem('libtables_tabid', tab);
    console.log(`Libtables generated tab id: ${tab}`);
  }
  else tab = sessionStorage.getItem('libtables_tabid');
  load($(document), true);
  window.setInterval(refresh, 30000);
});

function generateId(bytes) {
  let arr = new Uint8Array(bytes);
  return btoa(String.fromCharCode.apply(null, crypto.getRandomValues(arr)));
}

function tr(str) {
  if (lang == 0) return str;
  if (transl.hasOwnProperty(str) && (transl[str][lang] !== null)) return transl[str][lang];
  return str;
}

function escape(val) {
  if (typeof val == 'string') return val.replace(/</g, '&lt;').replace(/"/g, '&quot;');
  else return val;
}

function userError(msg) {
  alert(`${tr('Error')}: ${tr(msg)}`);
}
function appError(msg, context) {
  console.log(`Libtables error: ${msg}`);
  if (context) console.log('Context:', context);
}

function load(el, visible) {
  let tables, controls;
  if (visible) {
    tables = el.find('.lt-div:visible');
    controls = el.find('.lt-control:visible');
  }
  else {
    tables = el.find('.lt-div');
    controls = el.find('.lt-control');
  }

  tables.each(function() {
    let attr = $(this).data();
    loadTable($(this), attr);
  });
  controls.each(function() {
    let attr = $(this).data();
    loadControl($(this), attr);
  });
}
function refresh(root = $(document)) {
  root.find('.lt-table:visible').each(function() {
    let table = $(this);
    let src = $(this).attr('id');
    if (!table.length || !tables[src]) return;
    if (tables[src].data.rowcount) return; // rowcount is set for exports with nopreview=true
    refreshTable(table, src);
  });
  root.find('.lt-div-text:visible').each(function() {
    refreshText($(this));
  });
}

function refreshText(div) {
  let attr = div.data();
  if (!attr.source) return;
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=refreshtext&src=${attr.source}`,
    dataType: 'json',
    context: div,
    success: function(data) {
      if (data.error) appError(data.error, this);
      else this.html(data.text);
    }
  });
}

function loadOrRefreshCollection(coll, sub) {
  coll.each(function() {
    let div = $(this);
    if (div.hasClass('lt-div')) {
      let attr = div.data();
      let src = attr.source;
      if (!tables[src] || !document.getElementById(src)) loadTable(div, attr, sub); // Using getElementById() because jQuery gets confused by the colon in the id
      else refreshTable(div.find('table'), src);
    }
    else if (div.hasClass('lt-div-text')) refreshText(div);
    else if (div.hasClass('lt-control')) {
      if (div.is(':empty')) loadControl(div, div.data());
    }
  });
}
jQuery.fn.extend({
  activate: function() {
    return this.each(function() {
      let el = $(this);
      el.find('.lt-div').each(function() {
        let div = $(this);
        let attr = div.data();
        let src = attr.source;
        if (!tables[src] || !document.getElementById(src)) loadTable(div, attr); // Using getElementById() because jQuery gets confused by the colon in the id
        else refreshTable(div.find('table'), src);
      });
      el.find('.lt-control').each(function() { loadControl($(this), $(this).data()); });
      el.find('.lt-div-text').each(function() { refreshText($(this)); });
    });
  }
});

function doAction(button, addparam) {
  button = $(button);
  let table, thead, fullscreen = button.closest('#lt-fullscreen-div');
  if (fullscreen.length) {
    table = fullscreen.find('#lt-fullscreen-scroller table');
    thead = fullscreen.find('thead');
  }
  else {
    table = button.closest('table');
    thead = button.closest('thead');
  }
  let src = table.attr('id');

  let paramstr = '';
  if (addparam) paramstr = btoa(`[ "${addparam}" ]`);

  if (button.hasClass('lt-tableaction')) {
    let tbl = tables[src].data;
    $.ajax({
      method: 'post',
      url: `${ajaxUrl}?tab=${tab}&mode=action&src=${src}`,
      data: { type: 'table', params: paramstr },
      dataType: 'json',
      success: function(data) {
        let action = tbl.options.tableaction;
        if (data.error) appError(data.error, table);
        if (data.output) {
          if (action.output == 'block') {
            // $('#block_' + tbl.block).replaceWith(data.output);
            let coll = $(data.output).replaceAll('#block_' + tbl.block);
            loadOrRefreshCollection(coll.find('.lt-div,.lt-control'));
            return;
          }
          if (action.output == 'location') {
            window.location = data.output;
            return;
          }
          if (action.output == 'alert') alert(data.output);
          else if (action.output == 'function') {
            if (!action.functionname) {
              console.log(`Source ${src} has an action with output type function without a functionname parameter`);
              return;
            }
            window[action.functionname](data.output);
          }
        }
        refreshTable(table, src);
        if (tbl.options.trigger) loadOrRefreshCollection($('#' + tbl.options.trigger));
        // if (tbl.options.tableaction.trigger) loadOrRefreshCollection($('#' + tbl.options.tableaction.trigger));
        // if (tbl.options.tableaction.replacetext) thead.find('.lt-tableaction').val(tbl.options.tableaction.replacetext);
      }
    });
  }
  else if (button.hasClass('lt-rowaction')) {
    let actionid = button.parent().data('actionid');
    let tbl = tables[src].data;
    tbl.active = button.closest('.lt-row').data('rowid');
    $.ajax({
      method: 'post',
      url: `${ajaxUrl}?tab=${tab}&tab=${tab}&mode=action&src=${src}`,
      data: { type: 'row', params: paramstr, row: tbl.active, action: actionid },
      dataType: 'json',
      success: function(data) {
        let action = Array.isArray(tbl.options.rowaction)?tbl.options.rowaction[actionid]:tbl.options.rowaction;
        if (data.error) appError(data.error, table);
        if (data.usererror) userError(data.usererror);
        if (data.output) {
          if (action.output == 'block') {
            let coll = $(data.output).replaceAll('#block_' + tbl.block);
            loadOrRefreshCollection(coll.find('.lt-div,.lt-control'));
            return;
          }
          if (action.output == 'location') {
            window.location = data.output;
            return;
          }
          if (action.output == 'alert') alert(data.output);
          else if (action.output == 'function') {
            if (!action.functionname) {
              console.log(`Source ${src} has an action with output type function without a functionname parameter`);
              return;
            }
            window[action.functionname](data.output);
          }
          else console.log(`Action for source ${src} returned output: ${data.output}`);
        }
        refreshTable(table, src);
        if (tbl.options.trigger) loadOrRefreshCollection($('#' + tbl.options.trigger));
        // else if (data.redirect) window.location = data.redirect;
        // else if (data.replace) {
        //   $('#block_' + tbl.block).replaceWith(data.replace);
        //   let block = $('#block_' + tbl.block); // Need to fetch the new version of the block
        //   loadOrRefreshCollection(block.find('.lt-div'));
        //   block.find('.lt-control:visible').each(function() {
        //     let attr = $(table).data();
        //     loadControl($(table), attr);
        //   });
        // }
        // else {
        //   refreshTable(table, src);
        //   if (data.alert) alert(data.alert);
        //   if (tbl.options.trigger) loadOrRefreshCollection($('#' + tbl.options.trigger));
        // }
      }
    });
  }
}

function loadControl(div, attr) {
  let options = JSON.parse(atob(attr.options));
  let classes = 'lt-control-button';
  if (options.class) classes += ' ' + options.class;
  if (options.fields) {
    for (let field of options.fields) {
      if (field.length != 2) {
        console.log('Invalid lt_control field option; ignoring', field);
        continue;
      }
      div.append(`<label>${field[1]} <input type="text" class="lt-control-field" name="${field[0]}"></label>`);
    }
  }
  if (options.prev) {
    if (typeof options.prev == 'object') {
      div.append(`<input type="button" class="${classes}" value="${tr(options.prev[1])}" onclick="doNext(this, true)">`);
    }
    else div.append(`<input type="button" class="${classes}" value="${tr('Previous')}" onclick="doNext(this, true)">`);
  }
  if (options.next) {
    if (typeof options.next == 'object') {
      div.append(`<input type="button" class="${classes}" value="${tr(options.next[1])}" onclick="doNext(this)">`);
    }
    else div.append(`<input type="button" class="${classes}" value="${tr('Next')}" onclick="doNext(this)">`);
  }
  tables[attr.source] = {};
  tables[attr.source].div = div;
  tables[attr.source].options = options;
}

function loadTable(div, attr, sub) {
  let src = attr.source;
  let table = $(`<table id="${src}" class="lt-table"/>`);

  if (attr.embedded) {
    tables[src] = {};
    tables[src].table = table;
    let json = atob(attr.embedded.replace(/\n/g, ''));
    let data = JSON.parse(json);
    tables[src].data = data;
    renderTable(table, data);
    div.empty().append(tables[src].table);
    div.removeAttr('embedded');
  }
  // else if (tables[src] && tables[src].data && (tables[src].data.rowcount != -1) && tables[src].data.options && (tables[src].data.options.nocache !== true)) {
  //   if (tables[src].doingajax) {
  //     console.log(`Skipping load for${src} (already in progress)`);
  //     return;
  //   }
  //   console.log(tables[src]);
  //   tables[src].table = table;
  //   console.log(`Rendering table ${src} from existing data`);
  //   renderTable(table, tables[src].data);
  //   div.empty().append(tables[src].table);
  //   refreshTable(table, src);
  // }
  else {
    tables[src] = {};
    tables[src].table = table;
    tables[src].start = Date.now();
    tables[src].doingajax = true;
    $.ajax({
      method: 'post',
      url: `${ajaxUrl}?tab=${tab}&mode=gettable&src=${attr.source}`,
      dataType: 'json',
      context: div,
      success: function(data) {
        if (data.error) {
          this.empty().append('<p>Error from server while loading table. Technical information is available in the console log.</p>');
          appError(data.error, this);
        }
        else {
          data.downloadtime = Date.now() - tables[src].start - data.querytime;
          if (this.data('active')) data.active = this.data('active');
          tables[src].data = data;
          renderTable(table, data, sub);
          this.empty().append(tables[src].table);
          if (data.options.callbacks && data.options.callbacks.load) window.setTimeout(data.options.callbacks.load.replace('#src', this.data('source')), 0);
        }
        tables[src].doingajax = false;
      },
      error: function(xhr, status) { this.empty().append(`Error while loading table ${this.data('source')} (${status} from server)`); }
    });
  }
}

function refreshTable(table, src) {
  if (tables[src].doingajax) {
    console.log(`Skipping refresh on ${src} (already in progress)`);
    return;
  }
  tables[src].start = Date.now();
  tables[src].doingajax = true;
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=refreshtable&src=${src}`,
    data: { crc: tables[src].data.crc },
    dataType: 'json',
    context: table,
    success: function(data) {
      let options = tables[src].data.options;
      if (data.error) appError(data.error, this);
      else if (data.nochange); // No action
      else {
        tables[src].data.downloadtime = Date.now() - tables[src].start - data.querytime;
        if (tables[src].data.headers.length != data.headers.length) {
          console.log('Column count changed; reloading table');
          tables[src].data.headers = data.headers;
          tables[src].data.rows = data.rows;
          tables[src].data.crc = data.crc;
          tables[src].doingajax = false;
          loadTable(this.parent(), this.parent().data());
          return;
        }

        let tbody = this.find('tbody');
        if (!tbody.length) {
          tbody = $('<tbody/>');
          this.prepend(tbody);
        }

        if (data.rows.length) {
          let thead = table.find('thead');
          if (!thead.length) {
            thead = $('<thead/>');
            if (tables[src].data.title && this.closest('.lt-div').data('sub') != 'true') thead.append(renderTitle(tables[src].data));
            table.prepend(thead);
          }
          if (!thead.find('.lt-head').length && !tables[src].data.options.format) {
            thead.append(renderHeaders(tables[src].data, this.attr('id')));
          }
//          else updateHeaders(thead, data); // BROKEN: doesn't support mouseover or other hidden columns
        }

        updateTable(tbody, tables[src].data, data.rows);
        tables[src].data.rows = data.rows;
        tables[src].data.crc = data.crc;
        if (data.title) {
          let title = this.find('.lt-title');
          if (title.length) {
            let text = title[0].childNodes[0];
            if (text.nodeType == 3) text.data = data.title;
          }
        }
        if (options.sum) updateSums(this.find('tfoot'), tables[src].data);
        if (options.callbacks && options.callbacks.change) window.setTimeout(options.callbacks.change.replace('#src', this.parent().data('source')), 0);
      }
      if (options.tableaction && data.options && data.options.tableaction && ('sqlcondition' in data.options.tableaction)) {
        options.tableaction.sqlcondition = data.options.tableaction.sqlcondition;
        if (options.tableaction.sqlcondition) this.find('.lt-tableaction').show();
        else this.find('.lt-tableaction').hide();
      }
      tables[src].doingajax = false;
    }
  });
}

function updateHeaders(thead, data) {
  thead.find('.lt-head').each(function(i) {
    let th = $(this);
    if (th.html() != data.headers[i+1]) {
      th.html(data.headers[i+1]).css('background-color', 'green');
      setTimeout(function(th) { th.css('background-color', ''); }, 2000, th);
    }
  });
}

function sortOnColumn(a, b, index) {
  if (a[index] === null) return -1;
  if (a[index] === b[index]) return 0;
  else if (a[index] < b[index]) return -1;
  else return 1;
}

function colVisualToReal(data, idx) {
  if (!data.options.mouseover && !data.options.hidecolumn && !data.options.selectone && !data.options.selectany && !data.options.showid) return idx;
  if (data.options.showid) idx--;
  if (data.options.selectone) idx--;
  if (data.options.selectany) idx--;
  for (let c = 0; c <= data.headers.length; c++) {
    if (data.options.mouseover && data.options.mouseover[c]) idx++;
    else if (data.options.hidecolumn && data.options.hidecolumn[c]) idx++;
    if (c == idx) return c;
  }
}

function sortBy(tableId, el) {
  el = $(el);
  let table = tables[tableId].table;
  let data = tables[tableId].data;
  if (data.options.sortby == el.html()) {
    if (data.options.sortdir == 'ascending') data.options.sortdir = 'descending';
    else data.options.sortdir = 'ascending';
  }
  else {
    data.options.sortby = el.html();
    data.options.sortdir = 'ascending';
  }
  console.log(`Sort table ${tableId} on column ${el.html()} ${data.options.sortdir}`);

  let c = colVisualToReal(data, el.index()+1);
  if (data.options.sortdir == 'ascending') {
    data.rows.sort(function(a, b) { return sortOnColumn(a, b, c); });
    el.siblings().removeClass('lt-sorted-asc lt-sorted-desc');
    el.removeClass('lt-sorted lt-sorted-desc').addClass('lt-sorted-asc');
  }
  else {
    data.rows.sort(function(a, b) { return sortOnColumn(b, a, c); });
    el.siblings().removeClass('lt-sorted-asc lt-sorted-desc');
    el.removeClass('lt-sorted lt-sorted-asc').addClass('lt-sorted-desc');
  }

  let tbody = table.find('tbody');
  let rowcount = renderTbody(tbody, data);
  let div = table.closest('#lt-fullscreen-div');
  if (div.length) syncColumnWidths(div); // Table is in fullscreen mode
}

function goPage(tableId, which) {
  let table = tables[tableId].table;
  let data = tables[tableId].data;
  let old = data.options.page;
  if (isNaN(which)) {
    if (which == 'prev') data.options.page -= 1;
    else if (which == 'next') data.options.page += 1;
  }
  else data.options.page = which;
  if ((data.options.page <= 0) || ((data.options.page-1) * data.options.limit > data.rows.length)) {
    data.options.page = old;
    return;
  }
  let rowcount = 1;
  if (data.options.format) renderTableFormat(table.empty(), data);
  else rowcount = renderTbody(table.find('tbody'), data);
  if (data.options.limit) table.find('.lt-pages').html(`${tr('Page')} ${data.options.page} ${tr('of')} ${Math.ceil(rowcount/data.options.limit)}`);
}

function replaceHashes(str, row, returntype = false) {
  if (str.indexOf('#') >= 0) {
    str = str.replace(/#id/g, row[0]);
    for (let c = row.length-1; c >= 0; c--) {
      if (str.indexOf('#'+c) >= 0) {
        if (returntype && (str == '#'+c)) return row[c];
        let content;
        if (row[c] === null) content = '';
        else content = String(row[c]).replace('#', '\0');
        str = str.replace(new RegExp('#'+c, 'g'), content);
      }
    }
  }
  return str.replace('\0', '#');
}

function renderTable(table, data, sub) {
  let start = Date.now();
  let filters = sessionStorage.getItem(`lt_filters_${data.block}_${data.tag}`);
  if (filters) {
    filters = JSON.parse(filters);
    for (let i in filters) {
      if (filters[i].startsWith('<') || filters[i].startsWith('>') || filters[i].startsWith('=')) continue;
      filters[i] = new RegExp(filters[i], 'i');
    }
    data.filters = filters;
  }
  if (data.options.display && (data.options.display == 'list')) renderTableList(table, data, sub);
  else if (data.options.display && (data.options.display == 'divs')) renderTableDivs(table, data, sub);
  else if (data.options.display && (data.options.display == 'select')) renderTableSelect(table, data, sub);
  else if (data.options.display && (data.options.display == 'vertical')) renderTableVertical(table, data, sub);
  else if (data.options.format) renderTableFormat(table, data, sub);
  else if (data.options.renderfunction) window[data.options.renderfunction](table, data);
  else renderTableGrid(table, data, sub);
  console.log(`Load timings for ${sub?'sub':''}table ${data.tag}: sql ${data.querytime?data.querytime:'n/a'} download ${data.downloadtime?data.downloadtime:'n/a'} render ${Date.now()-start} ms`);
}

// function renderTableVertical(table, data) {
//   table.addClass('lt-insert');
//   for (id in data.options.insert) {
//     if (!$.isNumeric(id)) continue;
//     let input = renderField(data.options.insert[id], data, id);
//     let name;
//     if (data.options.insert[id].name !== undefined) name = data.options.insert[id].name;
//     else name = input.attr('name').split('.')[1];
//     let label = '<label for="' + input.attr('name') + '">' + name + '</label>';
//     let row = $('<tr><td class="lt-form-label">' + label + '</td><td class="lt-form-input"></td></tr>');
//     row.find('.lt-form-input').append(input);
//     table.append(row);
//   }
//   table.append('<tr><td colspan="2"><input type="button" class="lt-insert-button" value="' + tr('Insert') + '" onclick="doInsert(this)"></td></tr>');
// }

function renderTableSelect(table, data, sub) {
  let section = $(`<section class="lt-select"><h3>${data.title}</h3>`);

  let select;
  if (data.options.selectone) {
    if (typeof selectones == 'undefined') selectones = 1;
    else selectones++;
    select = `<select name="select${selectones}">`;
  }
  else select = '<select>';

  if (data.options.placeholder) select += `<option value="" disabled selected hidden>${data.options.placeholder}</option>`;

  for (let r = 0; r < data.rows.length; r++) { // Main loop over the data rows
    if (!data.rows[r][2]) select += `<option value="${data.rows[r][0]}">${escape(data.rows[r][1])}</option>`;
    else select += `<option value="${data.rows[r][0]}">${escape(data.rows[r][1])} (${escape(data.rows[r][2])})</option>`;
  }
  select += '</select>';
  section.append(select);

  if (data.options.selectone && data.options.selectone.default) {
    if (data.options.selectone.default == 'first') section.find('select').prop('selectedIndex', 0);
    else if (data.options.selectone.default == 'last') section.find('select').prop('selectedIndex', data.rows.length-1);
  }
  else if (!data.options.placeholder) section.find('select').prop('selectedIndex', -1);

  let src = table.attr('id');
  tables[src].table = section;
}

function renderTableDivs(table, data, sub) {
  let container = $('<div class="lt-div-table"/>');
  container.attr('id', table.attr('id'));
  if (data.options.class && data.options.class.table) container.addClass(data.options.class.table);

  let items = '';
  for (let r = 0; r < data.rows.length; r++) { // Main loop over the data rows
    let classes = '';
    if (Number.isInteger(data.options.classcolumn)) classes = ' ' + data.rows[r][data.options.classcolumn];
    items += `<div class="lt-div-row${classes}" data-rowid="${data.rows[r][0]}">`;
    if (data.options.rowlink) items += `<a href="${replaceHashes(data.options.rowlink, data.rows[r])}">`;
    for (let c = 1; c < data.rows[r].length; c++) { // Loop over the columns
      if (data.options.hidecolumn && data.options.hidecolumn[c]) continue;
      if (c === data.options.classcolumn) continue;
      items += renderCell(data.options, data.rows[r], c, 'div');
    }
    if (data.options.appendcell) items += `<div class="lt-cell lt-append">${replaceHashes(data.options.appendcell, data.rows[r])}</div>`;
    if (data.options.rowlink) items += '</a>';
    items += '</div>';
  }
  container.append($(items));
  tables[container.attr('id')].table = container;
}

function listClick(el) {
  $(el).find('input').prop('checked', true);
}

function renderTableList(table, data, sub) {
  let section = $(`<section class="lt-list"><h3>${data.title}</h3>`);
  let ul = '<ul>';

  if (data.options.selectone) {
    if (typeof selectones == 'undefined') selectones = 1;
    else selectones++;
  }

  for (let r = 0; r < data.rows.length; r++) { // Main loop over the data rows
    let style;
    if (data.options.style && data.options.style.list) style = ` style="${replaceHashes(data.options.style.list, data.rows[r])}"`;
    else style = '';
    ul += `<li data-rowid="${data.rows[r][0]}"${style} onclick="listClick(this);">`;
    if (data.options.selectone) {
      let trigger;
      if (data.options.selectone.trigger) trigger = ` data-trigger="${data.options.selectone.trigger}"`;
      else trigger = '';
      if (data.options.style && data.options.style.selectone) style = ` style="${replaceHashes(data.options.style.selectone, data.rows[r])}"`;
      else style = '';
      ul += `<span><input type="radio" name="select${selectones}" ${trigger}${style}></span>`;
    }
    ul += escape(data.rows[r][1]);
  }
  ul += '</ul>';
  section.append(ul);

  if (data.options.selectone && data.options.selectone.default) {
    if (data.options.selectone.default == 'first') section.find('input[name^=select]:first').prop('checked', true);
    else if (data.options.selectone.default == 'last') section.find('input[name^=select]:last').prop('checked', true);
  }

  let src = table.attr('id');
  tables[src].table = section;
}

function renderTableFormat(table, data, sub) {
  if (data.options.class && data.options.class.table) table.addClass(data.options.class.table);
  let headstr;
  if (data.options.hideheader || !data.title) headstr = '';
  else headstr = renderTitle(data);

  if (!data.options.page) {
    if (data.active) {
      for (let r = 0; data.rows[r]; r++) {
        if (data.rows[r][0] == data.active) {
          data.options.page = r+1;
          break;
        }
      }
    }
    if (!data.options.page) data.options.page = 1;
  }
  let offset = data.options.page - 1;

  if (data.rows && data.rows.length > 1) {
    headstr += `<tr class="lt-limit"><th colspan="${data.headers.length}">`;
    headstr += `<a href="javascript:goPage('${table.attr('id')}', 'prev')"><span class="lt-page-control">&lt;</span></a> `;
    headstr += `${data.options.pagename?data.options.pagename:tr('Row')} ${data.options.page} ${tr('of')} ${data.rows.length}`;
    headstr += ` <a href="javascript:goPage('${table.attr('id')}', 'next')"><span class="lt-page-control">&gt;</span></a></th></tr>`;
  }

  let thead = $(`<thead>${headstr}</thead>`);

  let tbody, fmt;
  if (data.options.format.indexOf('I') < 0) tbody = $('<tbody/>');
  else tbody = $('<tbody class="lt-insert"/>');

  if (data.options.pagetitle && data.rows && data.rows[offset]) {
    document.title = replaceHashes(data.options.pagetitle, data.rows[offset]);
  }

  renderTableFormatBody(tbody, data, offset);
  table.append(thead, tbody);
  table.parent().data('crc', data.crc);

  if (data.options.subtables) loadOrRefreshCollection(tbody.find('.lt-div'), true);
}
function renderTableFormatBody(tbody, data, offset) {
  let headcount = 0;
  let colcount = 0;
  let inscount = 0;
  let actcount = 0;
  let appcount = 0;
  let actions;
  let colspan;
  let rowspan = 0;
  let fmt;

  if (typeof(data.options.format) == 'string') fmt = data.options.format.split('\n');
  else fmt = data.options.format;

  if (data.options.rowaction) actions = $(renderActions(data.options.rowaction, data.rows[offset]));

  for (let r = 0; fmt[r]; r++) {
    let row = $(`<tr class="lt-row" data-rowid="${data.rows && data.rows[offset]?data.rows[offset][0]:0}"/>`);
    for (let c = 0; fmt[r][c]; c++) {
      if (fmt[r][c] == 'H') {
        if (headcount++ >= data.headers.length) {
          appError(`Too many headers specified in format string for ${data.block}:${data.tag}`, data.options.format);
          break;
        }
        while (data.options.mouseover && data.options.mouseover[headcount]) headcount++;
        for (rowspan = 1; fmt[r+rowspan] && fmt[r+rowspan][c] == '|'; rowspan++);
        for (colspan = 1; fmt[r][c+colspan] == '-'; colspan++);
        let tdstr = `<td class="lt-head"${colspan > 1?` colspan="${colspan}"`:''}${rowspan > 1?` rowspan="${rowspan}"`:''}>`;
        tdstr += tr(data.headers[headcount]);
        if (data.options.subheader && data.options.subheader[headcount]) tdstr += `<div class="lt-subhead">${data.options.subheader[headcount]}</div>`;
        tdstr += '</td>';
        row.append(tdstr);
      }
      else if (fmt[r][c] == 'C') {
        if (colcount++ >= data.rows[offset].length) {
          appError(`Too many columns specified in format string for ${data.block}:${data.tag}`, data.options.format);
          break;
        }
        while (data.options.mouseover && data.options.mouseover[colcount]) colcount++;
        for (rowspan = 1; fmt[r+rowspan] && fmt[r+rowspan][c] == '|'; rowspan++);
        for (colspan = 1; fmt[r][c+colspan] == '-'; colspan++);
        let cell = $(renderCell(data.options, data.rows[offset], colcount));
        if (colspan > 1) cell.attr('colspan', colspan);
        if (rowspan > 1) cell.attr('rowspan', rowspan);
        row.append(cell);
      }
      else if (fmt[r][c] == 'I') {
        let insert;
        inscount++;
        let count = 0;
        let colid;
        for (let i in data.options.insert) {
          if (!$.isNumeric(i)) continue;
          if (++count === inscount) {
            insert = data.options.insert[i];
            colid = colcount+inscount;
            break;
          }
        }
        if (!insert) {
          appError(`Too many insert cells specified in format string for ${data.block}:${data.tag}`, data.options.format);
          break;
        }
        for (rowspan = 1; fmt[r+rowspan] && fmt[r+rowspan][c] == '|'; rowspan++);
        for (colspan = 1; fmt[r][c+colspan] == '-'; colspan++);
        let td = $(`<td class="lt-cell"${colspan > 1?` colspan="${colspan}"`:''}${rowspan > 1?` rowspan="${rowspan}"`:''}/>`);
        let input = renderField(insert, data, colid);
        if (input.prop('required')) td.addClass('lt-input-required');
        td.append(input);
        row.append(td);
      }
      else if (fmt[r][c] == 'S') {
        for (rowspan = 1; fmt[r+rowspan] && fmt[r+rowspan][c] == '|'; rowspan++);
        for (colspan = 1; fmt[r][c+colspan] == '-'; colspan++);
        row.append(renderInsertButton(data.options.insert, colspan, rowspan));
        row.parent().find('INPUT[type=text],SELECT').on('keyup', function(e) { if (e.keyCode == 13) $(this).closest('tbody').find('.lt-insert-button').click(); });
      }
      else if ((fmt[r][c] == 'A') && data.options.appendcell) {
        for (rowspan = 1; fmt[r+rowspan] && fmt[r+rowspan][c] == '|'; rowspan++);
        for (colspan = 1; fmt[r][c+colspan] == '-'; colspan++);
        let tdstr = `<td class="lt-cell lt-append"${colspan > 1?` colspan="${colspan}"`:''}${rowspan > 1?` rowspan="${rowspan}"`:''}>`;
        if ((appcount > 0) && (!data.options.appendcell[appcount])) {
          appError(`Too many append cells specified in format string for ${data.block}:${data.tag}`, data.options.format);
          break;
        }
        let cell = data.options.appendcell[appcount] || data.options.appendcell;
        if (data.rows && data.rows[offset]) tdstr += replaceHashes(cell, data.rows[offset]) + '</td>';
        else tdstr += cell + '</td>';
        row.append(tdstr);
        appcount++;
      }
      else if ((fmt[r][c] == 'R') && (actions[actcount])) {
        console.log(actions[actcount]);
        for (rowspan = 1; fmt[r+rowspan] && fmt[r+rowspan][c] == '|'; rowspan++);
        for (colspan = 1; fmt[r][c+colspan] == '-'; colspan++);
        actions[actcount].colSpan = colspan;
        actions[actcount].rowSpan = rowspan;
        row.append(actions[actcount]);
        actcount++;
      }
      else if (fmt[r][c] == 'x') row.append('<td class="lt-unused"/>');
    }
    tbody.append(row);
  }
}

function renderTitle(data) {
  let str = `<tr><th class="lt-title" colspan="${data.headers.length+1}">${escape(tr(data.title))}`;
  // if (data.options.popout && (data.options.popout.type == 'floating-div')) {
  //   str += '<span class="lt-popout ' + (data.options.popout.icon_class?data.options.popout.icon_class:"");
  //   str += '" onclick="showTableInDialog($(this).closest(\'table\'));"></span>';
  // }
  // else if (data.options.popout && (data.options.popout.type == 'fullscreen')) {
  //   str += '<span class="lt-fullscreen-button ' + (data.options.popout.icon_class?data.options.popout.icon_class:"") + '" ';
  //   str += 'onclick="toggleTableFullscreen($(this).closest(\'table\'));"></span>';
  // }
  if (data.options.tableaction && data.options.tableaction.text) {
    let action = data.options.tableaction;
    let disp;
    if (('sqlcondition' in action) && !action.sqlcondition) disp = ' style="display: none;"';
    else disp = '';
    if (action.confirm) {
      str += `<input type="button" class="lt-tableaction"${disp} onclick="if (confirm('${tr(action.confirm)}')) doAction(this);" value="${tr(action.textparams)}">`;
    }
    else if (action.addparam && action.addparam.text) {
      str += `<input type="button" class="lt-tableaction"${disp} onclick="if ((ret = prompt('${tr(action.addparam.text)}')) != null) doAction(this, ret);" value="${tr(action.text)}">`;
    }
    else str += `<input type="button" class="lt-tableaction"${disp} onclick="doAction(this);" value="${escape(tr(action.text))}">`;
  }
  str += '</th></tr>';
 return str;
}

function renderHeaders(data, id) {
  let str = '';
  if (data.options.hideheaders) return str;
  if (data.options.limit) {
    if (!data.options.page) data.options.page = 1;
    str += `<tr class="lt-limit"><th colspan="${data.headers.length}"><a href="javascript:goPage('${id}', 'prev')">&lt;</a> <span class="lt-pages"></span> <a href="javascript:goPage('${id}', 'next')">&gt;</a></th></tr>`;
  }

  str += '<tr class="lt-row">';
  if (data.options.selectone) {
    if (typeof selectones == 'undefined') selectones = 1;
    else selectones++;
    if (data.options.selectone.name) str += `<td class="lt-head">${data.options.selectone.name}</td>`;
    else str += `<td class="lt-head">${tr('Select')}</td>`;
  }
  if (data.options.selectany) {
    if (data.options.selectany.name) str += `<td class="lt-head">${data.options.selectany.name}</td>`;
    else str += `<td class="lt-head">${tr('Select')}</td>`;
  }
  for (let c = 0; c < data.headers.length; c++) { // Loop over the columns for the headers
    if (data.options.sortby) {
      if (data.options.sortby == data.headers[c]) {
        if (data.options.sortdir == 'ascending') data.rows.sort(function(a, b) { return sortOnColumn(a, b, c); });
        else data.rows.sort(function(a, b) { return sortOnColumn(b, a, c); });
      }
    }
    if (!c && !data.options.showid) continue;
    if (data.options.mouseover && data.options.mouseover[c]) continue;
    if (data.options.hidecolumn && data.options.hidecolumn[c]) continue;
    let onclick = '';
    let classes = [ 'lt-head' ];
    if (data.options.sort) {
      if (typeof(data.options.sort) == 'boolean') {
        onclick = `sortBy('${id}', this);`;
        if (data.options.sortby == data.headers[c]) {
          if (data.options.sortdir == 'ascending') classes.push('lt-sorted-asc');
          else classes.push('lt-sorted-desc');
        }
        else classes.push('lt-sort');
      }
    }
    str += `<td class="${classes.join(' ')}" onclick="${onclick}">${escape(tr(data.headers[c]))}</td>`;
  }
  str += '</tr>';

  if (data.options.filter && (typeof data.options.filter != 'function')) {
    let filtertext = "Use these fields to filter the table\n" +
                     "Multiple filtered columns combine with AND logic\n" +
                     "Numeric matching is supported by starting with =, <, >, <= or >=\n" +
                     "Regular expressions can also be used, for example:\n" +
                     "  '^text' to match at the start\n" +
                     "  'text$' to match at the end\n" +
                     "  '(one|two)' to match one or two";
    let row = $('<tr class="lt-row"/>');
    if (data.options.selectone) row.append('<td/>');
    if (data.options.selectany) row.append('<td/>');
    for (let c = data.options.showid?0:1; c < data.headers.length; c++) {
      if (data.options.mouseover && data.options.mouseover[c]) continue;
      if (data.options.hidecolumn && data.options.hidecolumn[c]) continue;
      if ((data.options.filter === true) || data.options.filter[c]) {
        let text = '';
        if (data.filters && data.filters[c]) {
          if (data.filters[c].source) text = data.filters[c].source;
          else text = data.filters[c];
        }
        row.append(`<td class="lt-filter"><input type="search" oninput="updateFilter(this);" title="${filtertext}" value="${text}"></td>`);
      }
      else row.append('<td/>');
    }
    str += row.html();
  }

  return str;
}

function renderTableGrid(table, data, sub) {
  let pagetitle, thead = $('<thead/>'), tbody, tfoot, rowcount;

  if (data.options.class && data.options.class.table) table.addClass(data.options.class.table);
  if (data.title && !sub) thead.append(renderTitle(data));

  if ((data.rows && data.rows.length) || (data.rowcount >= 0) || data.options.emptytabletext) { // rowcount is set for exports with nopreview=true
    thead.append(renderHeaders(data, table.attr('id')));
  }
  else if (data.options.hidetableifempty) {
    table.hide();
    table.parent().data('crc', data.crc);
    return;
  }
  else if (data.options.insert && (typeof(data.options.insert) == 'object')) {
    tfoot = $('<tfoot/>');
    tfoot.append(renderInsert(data));
    table.append(thead, tfoot);
    table.parent().data('crc', data.crc);
    return;
  }

  if (data.rowcount >= 0) { // rowcount is set for exports with nopreview=true
    tbody = $(`<td colspan="${data.headers.length}" class="lt-cell"> ... ${data.rowcount} ${tr('rows for export')} ... </td>`);
  }
  else {
    tbody = $('<tbody/>');
    rowcount = renderTbody(tbody, data);
  }

  if (data.options.limit) thead.find('.lt-pages').html(`${tr('Page')} ${data.options.page} ${tr('of')} ${Math.ceil(rowcount/data.options.limit)}`);
  if (data.options.selectone && data.options.selectone.default) {
    if (data.options.selectone.default == 'first') tbody.find('input[name^=select]:first').prop('checked', true);
    else if (data.options.selectone.default == 'last') tbody.find('input[name^=select]:last').prop('checked', true);
  }

  tfoot = $('<tfoot/>');
  if (data.options.sum) calcSums(tfoot, data);

  if (data.options.appendrow) {
    let row = $('<tr class="lt-row"/>');
    row.html(data.options.appendrow);
    tfoot.append(row);
  }

  if (data.options.insert && (typeof(data.options.insert) == 'object')) {
    tfoot.append(renderInsert(data));
  }

  if (data.options.export) {
    if (data.options.export.xlsx) {
      tfoot.append(`<tr><td class="lt-foot lt-exports" colspan="${data.headers.length}">${tr('Export as')}: <a href="${ajaxUrl}?tab=${tab}&mode=excelexport&src=${data.block}:${data.tag}">Excel</a></td></tr>`);
    }
    else if (data.options.export.image) {
      tfoot.append(`<tr><td class="lt-foot lt-exports" colspan="${data.headers.length}">${tr('Export as')}: <a href="#" onclick="exportToPng(this);">${tr('Image')}</a></td></tr>`);
    }
  }

  table.append(thead, tbody, tfoot);
  table.parent().data('crc', data.crc);

  if (data.active) {
    let row = tbody.find(`tr[data-rowid="${data.active}"]`);
    row.addClass('lt-row-active');
    setTimeout(function (row) { row.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }); }, 100, row[0]);
    setTimeout(function (row) { row.removeClass('lt-row-active'); }, 5000, row);
  }
}

function renderInsert(data) {
  let fields;
  if (data.options.insert.include == 'edit') fields = jQuery.extend({}, data.options.edit, data.options.insert);
  else fields = data.options.insert;

  let rows = [];
  let row = $('<tr class="lt-row"/>');
  if (data.options.selectany) row.append('<td/>');
  let colspan = 1;
  if (data.options.delete) colspan++;
  if (data.options.appendcell) {
    if (typeof data.options.appendcell == 'string') colspan++;
    else colspan += data.options.appendcell.length;
  }
  if (!data.options.hideheaders) {
    for (let c = 1; ; c++) {
      let str;
      if (c >= data.headers.length) break;
      if (data.options.mouseover && data.options.mouseover[c]) continue;
      if (data.options.hidecolumn && data.options.hidecolumn[c]) continue;

      if (!fields[c]) str = '<td class="lt-head"></td>';
      else if (fields[c].label) str = `<td class="lt-head">${tr(fields[c].label)}</td>`;
      else str = `<td class="lt-head">${tr(data.headers[c])}</td>`;
      row.append(str);
    }
    rows.push(row);
  }

  row = $('<tr class="lt-row lt-insert"/>');
  if (data.options.selectany) row.append('<td/>');
  for (let c = 1; ; c++) {
    if (data.options.mouseover && data.options.mouseover[c]) continue;
    if (data.options.hidecolumn && data.options.hidecolumn[c]) continue;
    let insert = null;
    if (!fields[c]) {
      if (c >= data.headers.length) break;
      else {
        row.append('<td class="lt-cell"></td>');
        continue;
      }
    }
    let cell = $('<td/>');
    let classes = [ 'lt-cell' ];
    if (data.options.class && data.options.class[c]) classes.push(data.options.class[c]);
    cell.addClass(classes.join(' '));
    let input = renderField(fields[c], data, c);
    if (input.prop('required')) cell.addClass('lt-input-required');
    cell.append(input);
    if (insert) cell.append(insert);
    row.append(cell);
  }
  row.append(renderInsertButton(fields, colspan, 1));
  row.find('INPUT[type=text],SELECT').on('keyup', function(e) { if (e.keyCode == 13) $(this).parent().parent().find('.lt-insert-button').click(); });
  rows.push(row);
  return rows;
}

function renderInsertButton(fields, colspan, rowspan) {
  let str = `<td class="lt-cell" colspan="${colspan}">`;
  let label;
  if (fields.submit) {
    if (fields.submit.label) label = fields.submit.label;
    else if (typeof fields.submit == 'string') label = fields.submit;
    else label = tr('Insert');
  }
  else label = tr('Insert');
  let classes = 'lt-insert-button';
  if (fields.submit && fields.submit.class) classes += ' ' + fields.submit.class;
  str += `<input type="button" class="${classes}" value="${label}" onclick="doInsert(this)"></td>`;
  return str;
}

function renderField(field, data, c) {
  let input;
  if (field.type == 'checkbox') input = $(`<input type="checkbox" class="lt-insert-input" name="${field.target}">`);
  else if (field.type == 'date') input = $(`<input type="date" class="lt-insert-input" name="${field.target}" value="${new Date().toISOString().slice(0, 10)}">`);
  else if (field.type == 'password') input = $(`<input type="password" class="lt-insert-input" name="${field.target}">`);
  else if (field.type == 'email') input = $(`<input type="email" class="lt-insert-input" name="${field.target}">`);
  else if (field.type == 'color') input = $(`<input type="text" class="lt-insert-input lt-color-cell" name="${field.target}" onfocus="showColPick(this)">`);
  else if (field.type == 'multiline') {
    input = $(`<textarea class="lt_insert" class="lt-insert-input" name="${field.target}"/>`).autoHeight();
  }
  else if (field.type == 'number') {
    input = $(`<input type="number" class="lt-insert-input" name="${field.target}">`);
    if (field.min) input.attr('min', field.min);
    if (field.max) input.attr('max', field.max);
  }
  else if (field.type == 'file') {
    input = $(`<input type="file" class="lt-insert-input" name="${field.target}">`);
  }
  else if (field.type == 'image') {
    input = $(`<input type="file" class="lt-insert-input" name="${field.target}" accept=".jpg,.jpeg,.png">`);
  }
  else if (!field.query) {
    if (data.types[c] == 'LONG') input = $(`<input type="number" class="lt-insert-input" name="${field.target}">`);
    else input = $(`<input type="text" class="lt-insert-input" name="${field.target}">`);
  }
  else {
    input = $(`<select class="lt-insert-input" name="${field.target}"/>`);
    if (field.default) input.default = field.default;
    if (field.defaultid) input.defaultid = field.defaultid;
    if (field.insert || field[2]) {
      let setting, insert;
      if (field.insert) setting = field.insert;
      else setting = field[2];
      if (setting.type == '2-step') insert = $(`<input type="button" class="lt-add-option" value="➕" onclick="addOption(this, ${c});">`);
      else {
        let target;
        if (setting.target) target = setting.target;
        else target = setting[1];
        insert = $(`<input type="button" class="lt-add-option" value="➕" onclick="switchToText(this, '${target}');">`);
      }
    }
    if (!field.list) loadOptions(input, data, c);
    else {
      lists[field.query] = field.list;
      renderOptions(input, field.list, field.required?true:false);
    }
  }
  if (field.label) input.attr('data-label', field.label);
  else input.attr('data-label', data.headers[c]);
  if (field.required && (field.type != 'checkbox')) {
    input.prop('required', true);
    if (field.required.regex) input.prop('pattern', field.required.regex);
    if (field.required.message) input.prop('title', tr(field.required.message));
  }
  if (field.default) {
    if (input.prop('nodeName') != 'SELECT') input.val(field.default);
    input.data('default', field.default);
  }
  if (field.placeholder) input.attr('placeholder', field.placeholder);
  if (field.minlength) input.prop('minlength', field.minlength);
  if (field.maxlength) input.prop('maxlength', field.maxlength);
  if (field.domid) input.attr('id', field.domid);
  if (field.class) input.addClass(field.class);
  return input;
}

function showColPick(el) {
  let cell = $(el).parent();
  cell.colpick({
    layout: 'hex',
    onSubmit: function(hsb, hex) {
      cell.find('input').val('#' + hex);
      cell.css('background-color', '#' + hex);
      cell.colpickHide();
    }
  }).colpickShow();
}

function loadOptions(input, data, c) {
  let query;
  let insert;
  if (data.options.insert[c]) insert = data.options.insert[c]
  else if ((data.options.insert.include == 'edit') && (data.options.edit[c])) insert = data.options.edit[c];
  else {
    console.log(`Insert configuration for table ${data.tag} column ${c} not found`);
    return;
  }
  let params = { col: c };
  if (query && lists[query]) {
    params.crc = lists[query].crc;
    renderOptions(input, lists[query], insert.required?true:false);
  }
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=selectbox&src=${data.block}:${data.tag}`,
    data: params,
    dataType: 'json',
    context: input,
    success: function(data) {
      if (data.error) {
        this.parent().css({ backgroundColor: '#ffa0a0' });
        appError(data.error, this);
      }
      else if (data.nochange);
      else {
        lists[query] = data;
        renderOptions(this, data, insert.required?true:false);
      }
    }
  });
}
function renderOptions(select, list, required) {
  select.empty();
  if (!required) select.append('<option value=""></option>');
  for (let i = 0; list.items[i]; i++) {
    let selected;
    if (select.default && (select.default == 'first') && (i == 0)) selected = ' selected';
    else if (select.default && (select.default == list.items[i][1])) selected = ' selected';
    else if (select.defaultid && (select.defaultid == list.items[i][0])) selected = ' selected';
    else selected = '';
    let name = list.items[i][1];
    if (list.items[i][2]) name += ` (${list.items[i][2]})`;
    select.append(`<option value="${list.items[i][0]}"${selected}>${name}</option>`);
  }
  if (!select.default && !select.defaultid) select.prop('selectedIndex', -1); // This selects nothing, rather than the first option
}

function addOption(el, c) {
  let option = prompt(tr('New entry:'));
  if (!option) return;
  let src = $(el).closest('table').attr('id');
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=addoption&src=${src}`,
    data: { col: c, option: option },
    dataType: 'json',
    context: el,
    success: function(data) {
      if (data.error) return appError(data.error, this);
      if (!data.insertid) return appError("Mode addoption didn't return an insert id");
      $(el).siblings('select').append(`<option value="${data.insertid}" selected>${option}</option>`);
    }
  });
}
function switchToText(el, target) {
  let cell = $(el).closest('.lt-cell');
  cell.children().hide().filter('select').empty();
  cell.append(`<input type="text" class="lt-addoption" name="${target}">`).find('input').focus();
}
function switchToSelect(el) {
  let cell = $(el).closest('.lt-cell');
  let src = cell.closest('table').attr('id');
  let data = tables[src].data;
  let c = colVisualToReal(data, cell.index()+1);
  cell.find('.lt-addoption').remove();
  loadOptions(cell.find('select'), data, c);
  cell.children().show();
}

// function exportToPng(el) {
//   let exports = $(el);
//   let div = exports.closest('table');
//   exports.closest('tr').css('display', 'none');
//   if (!domtoimage) $.ajax({
//     url: 'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.5.2/dom-to-image.min.js',
//     dataType: "script",
//     async: false
//   });
//   domtoimage.toPng(div.get(0), { height: div.height()+10, width: div.width()+10 })
//             .then(function(url) {
//               let link = document.createElement('a');
//               link.download = div.find('.lt-title').html() + '.png';
//               link.href = url;
//               document.body.appendChild(link);
//               link.click();
//               document.body.removeChild(link);
//               exports.closest('tr').css('display', 'table-row');
//             });
// }

function isFiltered(filters, row, options) {
  for (let i in filters) {
    if (filters[i] instanceof RegExp) {
      if ((typeof row[i] == 'string') && (row[i].search(filters[i]) >= 0)) continue;
      if (typeof row[i] == 'boolean') {
        if (String(row[i]).search(filters[i]) >= 0) continue;
        if (row[i] && options.edit && options.edit[i] && options.edit[i].truevalue && (options.edit[i].truevalue.search(filters[i]) >= 0)) continue;
        if (!row[i] && options.edit && options.edit[i] && options.edit[i].falsevalue && (options.edit[i].falsevalue.search(filters[i]) >= 0)) continue;
      }
    }
    else if (filters[i].startsWith('>=')) {
      if (row[i] >= parseFloat(filters[i].substring(2))) continue;
    }
    else if (filters[i].startsWith('>')) {
      if (row[i] > parseFloat(filters[i].substring(1))) continue;
    }
    else if (filters[i].startsWith('<=')) {
      if (row[i] <= parseFloat(filters[i].substring(2))) continue;
    }
    else if (filters[i].startsWith('<')) {
      if (row[i] < parseFloat(filters[i].substring(1))) continue;
    }
    else if (filters[i].startsWith('=')) {
      if (row[i] == parseFloat(filters[i].substring(1))) continue;
    }
    return true;
  }
  return false;
}

function renderTbody(tbody, data) {
  let offset, rowcount = 0, rows = [];
  if (data.options.page) offset = data.options.limit * (data.options.page - 1);
  else offset = 0;

  if (!data.rows.length && data.options.emptytabletext) {
    rows.push(`<tr class="lt-row"><td class="lt-cell lt-empty-placeholder" colspan="${data.headers.length}">${data.options.emptytabletext}</td></tr>`);
    rowcount = 1;
  }
  else {
    for (let r = 0; r < data.rows.length; r++) { // Main loop over the data rows
      if (data.filters && isFiltered(data.filters, data.rows[r], data.options)) continue;
      rowcount++;
      if (rowcount <= offset) continue;
      if (data.options.limit && (offset+data.options.limit < rowcount)) continue;
      if ((rowcount == offset) && data.options.pagetitle) document.title = replaceHashes(data.options.pagetitle, data.rows[r]);
      rows.push(renderRow(data.options, data.rows[r]));
    }
  }
  tbody[0].innerHTML = rows.join('');
  tbody.width(); // Force a DOM reflow to fix an IE9-11 bug https://stackoverflow.com/a/21032333
  return rowcount;
}

function renderRow(options, row) {
  let html = [ `<tr class="lt-row" data-rowid="${row[0]}">` ];
  if (options.selectone) {
    let trigger;
    if (options.selectone.trigger) trigger = ` data-trigger="${options.selectone.trigger}"`;
    else trigger = '';
    html.push(`<td><input type="radio" name="select${selectones}" ${trigger}></td>`);
  }
  if (options.selectany) {
    let checked;
    if (options.selectany.links && (options.selectany.links.indexOf(row[0]) >= 0)) checked = ' checked';
    else checked = '';
    html.push(`<td class="lt-cell"><input type="checkbox" onchange="doSelect(this)"${checked}></td>`);
  }
  for (let c = options.showid?0:1; c < row.length; c++) { // Loop over each column
    if (options.mouseover && options.mouseover[c]) continue;
    if (options.hidecolumn && options.hidecolumn[c]) continue;
    html.push(renderCell(options, row, c));
  }
  if (options.appendcell) {
    if (typeof options.appendcell == 'string') html.push(`<td class="lt-cell lt-append">${replaceHashes(options.appendcell, row)}</td>`);
    else for (let cell of options.appendcell) html.push(`<td class="lt-cell lt-append">${replaceHashes(cell, row)}</td>`);
  }
  if (options.rowaction) html.push(renderActions(options.rowaction, row));
  if (options.delete && row[0]) { // Special rows may have null for id; they can't be deleted so don't show the button
  let value;
    if (options.delete.text) value = options.delete.text;
    else value = '✖';
    if (options.delete.notids && (options.delete.notids.indexOf(row[0]) >= 0));
    else if (options.delete.html) html.push(`<td class="lt-cell lt-append"><a onclick="doDelete(this)">${options.delete.html}</a></td>`);
    else html.push(`<td class="lt-cell lt-append"><input type="button" class="lt-delete" value="${value}" onclick="doDelete(this);"></td>`);
  }
  html.push('</tr>');
  return html.join('');
}

function renderCell(options, row, c, element) {
  if (!element) element = 'td';
  let input, onclick;
  let classes = [ 'lt-cell', 'lt-data' ];
  if (options.class && options.class[c]) classes.push(options.class[c]);
  if (options.edit && options.edit[c]) {
    classes.push('lt-edit');
    if (typeof(options.edit[c]) == 'string') onclick = ' onclick="doEdit(this)"';
    else if (typeof(options.edit[c]) == 'object') {
      if (options.edit[c].required && (row[c] === null)) classes.push('lt-required-empty');
      if (options.edit[c].condition && !eval(replaceHashes(options.edit[c].condition, row))) {
        onclick = '';
        classes.pop(); // Remove the .lt-edit class
      }
      else if (options.edit[c].show) { // Supported is 'always' and 'switch'
        input = renderEdit(options.edit[c], null, row[c], ' onchange="directEdit(this);"');
        if (options.edit[c].required && ((row[c] === false) || (row[c] === options.edit[c].falsevalue))) classes.push('lt-required-empty');
        if (options.edit[c].show == 'switch') {
          let arr = new Uint8Array(8);
          crypto.getRandomValues(arr);
          let id = arr.join('');
          input = input.replace('id="editbox"', `id="${id}" class="lt-switch-input"`);
          input += `<label for="${id}" class="lt-switch-label"></label>`;
          classes.push('lt-switch');
        }
      }
      else if (options.edit[c].query || (!options.edit[c].target && (options.edit[c].length >= 2))) onclick = ' onclick="doEditSelect(this)"';
      else onclick = ' onclick="doEdit(this)"';
    }
  }
  else onclick = "";
  let mouseover, style, content;
  if (options.mouseover && options.mouseover[c+1] && row[c+1]) {
    mouseover = ` title="${row[c+1]}"`;
    classes.push('lt-mouseover');
  }
  else mouseover = '';
  if (options.style && options.style[c]) style = ` style="${replaceHashes(options.style[c], row)}"`;
  else style = '';

  if (options.subtables && (options.subtables[c])) {
    content = `<div class="lt-div" data-source="${options.subtables[c]}" data-sub="true">Loading subtable ${options.subtables[c]}</div>`;
  }
  else if (options.transformation && options.transformation[c] && options.transformation[c].image) {
    content = `<img src="${replaceHashes(options.transformation[c].image, row)}">`;
  }
  else if (options.transformation && options.transformation[c] && options.transformation[c].round && $.isNumeric(row[c])) {
    content = parseFloat(row[c]).toFixed(options.transformation[c].round);
  }
  else if (input) content = input;
  else if (row[c] === null) {
    if (typeof options.emptycelltext == 'string') content = $('<div/>').text(options.emptycelltext).html(); // Run through jQuery .text() and .html() to apply HTML entity escaping
    else content = '';
  }
  else if (options.transformation && options.transformation[c] && options.transformation[c].allowhtml) {
    content = row[c];
  }
  else content = escape(row[c]);

  return `<${element} class="${classes.join(' ')}"${style + onclick + mouseover}>${content}</${element}>`;
}

function renderActions(actions, row) {
  let str = '';
  let action;
  for (let i in actions)  {
    let onclick = '';
    let disabled = '';
    if (typeof actions.text == 'string') {
      action = actions;
      i = 0;
    }
    else if (typeof actions[i] !== 'object') continue;
    else action = actions[i];
    str += `<td class="lt-cell lt-action" data-actionid="${i}" `;
    // if (actions[i].jscondition) {
    //   if (!eval(replaceHashes(actions[i].jscondition, row))) str += ' style="display: none;">';
    // }
    if (action.condition) {
      if (!arrayCondition(action.condition, row)) {
        switch (action.condition[3]) {
          case 'disable':
            disabled = ' disabled="disabled"';
            break;
          case 'hide':
          default:
            str += ' style="display: none;"';
        }
      }
    }
    if (!action.confirm) onclick = 'doAction(this);';
    else onclick = `if (confirm('${replaceHashes(tr(action.confirm), row)}')) doAction(this);`;
    str += `><input type="button" class="lt-rowaction" value="${replaceHashes(escape(tr(action.text)), row)}" onclick="${onclick}"${disabled}></td>`;
    if (typeof actions.text == 'string') break;
  }
  return str;
}

function arrayCondition(condition, row) {
  let left = (typeof condition[0] == 'string'?replaceHashes(condition[0], row, true):condition[0]);
  let right = (typeof condition[2] == 'string'?replaceHashes(condition[2], row, true):condition[2]);
  switch (condition[1]) {
    case '==': return (left == right);
    case '!=': return (left != right);
    case '<=': return (left <= right);
    case '<': return (left < right);
    case '>=': return (left >= right);
    case '>': return (left > right);
    case 'regex': return new RegExp(right).test(left);
    case '!regex': return !(new RegExp(right).test(left));
    default: console.err('Invalid comparison in rowaction condition');
  }
}

function calcSums(tfoot, data, update) {
  let avgs = [];
//  if ((typeof(data.options.sum) === 'string') && (data.options.sum.indexOf('#') == 0)) {
//    let col = parseInt(data.options.sum.substring(1));
//    if (!isNaN(col)) sums.push(col);
//  }

  let labeldone = 0;
  let row = $('<tr class="lt-sums">');
  for (let c = 1; c < data.headers.length; c++) {
    if (data.options.mouseover && data.options.mouseover[c]) continue;
    let classes = [ 'lt-cell', 'lt-sum' ];
    if (data.options.class && data.options.class[c]) classes.push(data.options.class[c]);
    if (data.options.sum[c]) {
      let sum = 0, content;
      for (let r = 0; r < data.rows.length; r++) {
        if (data.rows[r][c]) sum += parseFloat(data.rows[r][c]);
      }
      if (data.options.transformation && data.options.transformation[c]) {
        if (data.options.transformation[c].round) content = sum.toFixed(data.options.transformation[c].round);
      }
      else content = Math.round(sum*1000000)/1000000;
      row.append(`<td class="${classes.join(' ')}">${content}</td>`);
    }
    else if (!labeldone) {
      row.append(`<td class="${classes.join(' ')}">${tr('Total')}</td>`);
      labeldone = 1;
    }
    else row.append('<td/>');
  }
  tfoot.append(row);
}
function updateSums(tfoot, data) {
  let row = tfoot.find('tr.lt-sums');
  let skipped = 0;
  for (let c = 1; c < data.headers.length; c++) {
    if (data.options.mouseover && data.options.mouseover[c]) {
      skipped++;
      continue;
    }
    if (data.options.sum[c]) {
      let sum = 0;
      for (let r = 0; r < data.rows.length; r++) {
        if (data.filters && isFiltered(data.filters, data.rows[r], data.options)) continue;
        if (data.rows[r][c]) sum += parseFloat(data.rows[r][c]);
      }
      sum = String(Math.round(sum*1000000)/1000000);
      let oldsum = row.children().eq(c-1-skipped).html();
      if (data.options.transformation && data.options.transformation[c]) {
        if (data.options.transformation[c].round) sum = parseFloat(sum).toFixed(data.options.transformation[c].round);
      }
      if (sum != oldsum) {
        let cell = row.children().eq(c-1-skipped);
        cell.html(sum);
        cell.css('background-color', 'green');
        setTimeout(function(cell) { cell.css('background-color', ''); }, 2000, cell);
      }
    }
  }
}

function updateTable(tbody, data, newrows) {
  let start = Date.now();
  let oldrows = data.rows;
  newrows = newrows.slice(); // Copy the array so that we can filter out the existing rows

  if (newrows.length) tbody.find('.lt-empty-placeholder').remove();
  else if (data.options.emptytabletext && (tbody.find('.lt-empty-placeholder').length == 0)) {
    tbody.prepend(`<tr class="lt-row"><td class="lt-cell lt-empty-placeholder" colspan="${data.headers.length}">${data.options.emptytabletext}</td></tr>`);
  }

  if (data.options.format) {
    let rowid = tbody.find('.lt-row').data('rowid');
    if (rowid) {
      for (let i = 0; i < oldrows.length; i++) {
        if (oldrows[i][0] == rowid) {
          for (let j = 0; j < newrows.length; j++) {
            if (newrows[j][0] == rowid) {
              updateRow(data.options, tbody, oldrows[i], newrows[j]);
              return;
            }
          }
          break;
        }
      }
    }

    data.rows = newrows;
    if (data.options.page < newrows.length) data.options.page = newrows.length;
    renderTableFormatBody(tbody.empty(), data, data.options.page-1);
    return;
  }

  for (let i = 0, found; i < oldrows.length; i++) {
    found = 0;
    for (let j = 0; j < newrows.length; j++) {
      if (oldrows[i][0] == newrows[j][0]) { // Row remains
        if (!data.options.format || (i+1 == data.options.page)) updateRow(data.options, tbody, oldrows[i], newrows[j]);
        newrows.splice(j, 1);
        found = 1;
        break;
      }
    }
    if (!found) { // Row deleted
      let row = tbody.children(`[data-rowid="${oldrows[i][0]}"]`);
      if (row.length) {
        row.addClass('notransition');
        row.css('background-color', 'red');
        if (!data.options.format) {
          row.animate({ opacity: 0 }, 2000, 'swing', function() {
            $(this).css('height', $(this).height());
            $(this).empty();
            $(this).animate({ height: 0 }, 1000, 'linear', function() { $(this).remove(); });
          });
        }
      }
    }
  }
  for (let i = 0; i < newrows.length; i++) { // Row added
    if (data.options.format && (i+1 != data.options.page)) continue;
    let row = $(renderRow(data.options, newrows[i]));
    row.css({ 'background-color': 'green' });
    tbody.append(row);
    setTimeout(function(row) { row.css({ 'background-color': '' }); }, 1000, row);
  }
  console.log(`Refresh timings for table ${data.tag}: sql ${data.querytime} download ${data.downloadtime} render ${(Date.now()-start)} ms`);
}
function updateRow(options, tbody, oldrow, newrow) {
  let offset = 1;
  let changes = false;

  for (let c = 1; c < oldrow.length; c++) {
    let cell = null;
    if (options.edit && options.edit[c] && (options.edit[c].show == 'switch')) continue;
    if (options.mouseover && options.mouseover[c]) {
      offset++;
      if (oldrow[c] != newrow[c]) {
        let cell;
        changes = true;
        if (options.format) cell = tbody.find('.lt-data').eq(c-1);
        else cell = tbody.children(`[data-rowid="${oldrow[0]}"]`).children().eq(c-offset);
        if (cell) {
          cell.attr('title', newrow[c]?newrow[c]:(newrow[c]===false?'false':''));
          cell.css('background-color', 'green');
          if (newrow[c]) cell.addClass('lt-mouseover');
          else cell.removeClass('lt-mouseover');
          setTimeout(function(cell) { cell.css('background-color', ''); }, 2000, cell);
        }
      }
    }
    else if (oldrow[c] != newrow[c]) {
      changes = true;
      if (options.hidecolumn && options.hidecolumn[c]) {
        offset++;
        continue;
      }
      if (options.format) cell = tbody.find('.lt-data').eq(c-1);
      else cell = tbody.children(`[data-rowid="${oldrow[0]}"]`).children().eq(c-offset);
      if (cell) {
        let newcell = $(renderCell(options, newrow, c));
        cell.replaceWith(newcell);
        cell = newcell;
        cell.css('background-color', 'green');
        setTimeout(function(cell) { cell.css('background-color', ''); }, 2000, cell);
      }
      else appError('Updated cell not found', tbody);
    }

    if (options.style && options.style[c]) {
      if (!cell) {
        if (options.format) cell = tbody.find('.lt-data').eq(c-1);
        else cell = tbody.children(`[data-rowid="${oldrow[0]}"]`).children().eq(c-offset);
      }
      if (cell) cell.attr('style', replaceHashes(options.style[c], newrow));
    }
  }

  if (changes) {
    let cell;
    if (options.pagetitle) document.title = replaceHashes(options.pagetitle, newrow);
    if (options.rowaction) {
      if (options.format) cell = tbody.find('.lt-action');
      else cell = tbody.children(`[data-rowid="${oldrow[0]}"]`).find('.lt-action');
      if (cell.length) {
        let row = cell.parent();
        cell.remove();
        row.append(renderActions(options.rowaction, newrow));
      }
    }
    if (options.appendcell) {
      if (options.format) cell = tbody.find('.lt-append');
      else cell = tbody.children(`[data-rowid="${oldrow[0]}"]`).find('.lt-append');
      if (cell.length) {
        content = replaceHashes(options.appendcell, newrow);
        if (cell.html() !== content.replace(/&/g, '&amp;')) {
          cell.text(content);
          cell.css('background-color', 'green');
          setTimeout(function(cell) { cell.css('background-color', ''); }, 2000, cell);
        }
      }
    }
  }
}

function updateFilter(edit) {
  edit = $(edit);
  let table = edit.closest('table');
  let fullscreen = table.closest('#lt-fullscreen-div');
  if (fullscreen.length) table = fullscreen.find('#lt-fullscreen-scroller table');
  let data = tables[table.attr('id')].data;
  let c = colVisualToReal(data, edit.parent().index()+1);
  if (!data.filters) data.filters = {};
  edit.css('background-color', '');
  if (edit.val() === '') delete data.filters[c];
  else if (edit.val().search(/^[<>= ]+$/) >= 0) edit.css('background-color', 'rgba(255,0,0,0.5)');
  else if (edit.val().startsWith('<') || edit.val().startsWith('>') || edit.val().startsWith('=')) data.filters[c] = edit.val();
  else {
    try { data.filters[c] = new RegExp(edit.val(), 'i'); }
    catch (e) { edit.css('background-color', 'rgba(255,0,0,0.5)'); }
  }
  runFilters(table, data);
  if (fullscreen.length) syncColumnWidths(fullscreen);
  if (data.options.sum) updateSums(table.find('tfoot'), data);
  let filters = {};
  for (let i in data.filters) {
    filters[i] = (data.filters[i].source?data.filters[i].source:data.filters[i]);
  }
  sessionStorage.setItem(`lt_filters_${data.block}_${data.tag}`, JSON.stringify(filters));
}
function runFilters(table, data) {
  if (data.options.page > 1) data.options.page = 1;
  let tbody = table.find('tbody');
  let rowcount = renderTbody(tbody, data);
  if (data.options.limit) table.find('.lt-pages').html(`${tr('Page')} ${data.options.page} ${tr('of')} ${Math.ceil(rowcount/data.options.limit)}`);
}
function clearFilters(src) {
  let table = $(document.getElementById(src));
  let data = tables[table.attr('id')].data;
  table.find('.lt-filter').children('input').css('background-color', '').val('');
  data.filters = {};
  runFilters(table, data);
  let fullscreen = table.closest('#lt-fullscreen-div');
  if (fullscreen.length) {
    fullscreen.find('thead .lt-filter input').css('background-color', '').val('');
    syncColumnWidths(fullscreen);
  }
}

function renderEdit(edit, cell, content, handler) {
  if (handler === undefined) handler = '';
  let input;
  if (edit.type == 'multiline') {
    input = `<textarea id="editbox" name="input" style="width: ${cell.width()}px; height: ${cell.height()}px;">${escape(content)}</textarea>`;
  }
  else if (edit.type == 'checkbox') {
    let checked;
    if ((content === true) || (content === (edit.truevalue || 'true'))) checked = ' checked';
    else checked = '';
    input = `<input type="checkbox" id="editbox" name="input"${checked + handler}>`;
  }
  else if (edit.type == 'password') {
    input = '<input type="password" id="editbox" name="input">';
  }
  else if (edit.type == 'date') {
    let res, value;
    if (res = content.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})$/)) value = `${res[3]}-${res[2]}-${res[1]}`;
    else value = content;
    input = `<input type="date" id="editbox" name="input" value="${value}">`;
  }
  else if (edit.type == 'email') {
    input = `<input type="email" id="editbox" name="input" value="${escape(content)}">`;
  }
  else if (edit.type == 'datauri') {
    input = '<input type="file" id="editbox" name="input">';
  }
  else {
    let pattern;
    if (edit.pattern) pattern = ` pattern="${edit.pattern}"`;
    else pattern = '';
    input = `<input type="text" id="editbox" name="input" value="${escape(content)}"${pattern} style="width: ${cell.width()}px; height: ${cell.height()}px;">`;
  }
  return $(input);
}

function doEdit(cell, newcontent) {
  cell = $(cell);
  if (cell.hasClass('lt-editing')) return;
  cell.addClass('lt-editing');
  let content = cell.text(), c;
  let data = tables[cell.closest('table').attr('id')].data;
  if ((typeof data.options.emptycelltext == 'string') && (content === $('<div/>').text(data.options.emptycelltext).html())) content = '';
  if (data.options.format) c = cell.closest('tbody').find('.lt-data').index(cell)+1;
  else c = cell.parent().children('.lt-data').index(cell)+1;

  let edit = renderEdit(data.options.edit[c], cell, typeof newcontent == 'string'?newcontent:content);
  cell.empty().append(edit);

  if (data.options.edit[c].type == 'datauri') {
    edit.on('change', function() {
      if (edit[0].files[0]) {
        let fr = new FileReader();
        $(fr).on('load', function() {
          checkEdit(cell, edit, fr.result);
          cell.removeClass('lt-editing');
        });
        fr.readAsDataURL(edit[0].files[0]);
      }
    });
    return;
  }

  if (edit.prop('nodeName') == 'TEXTAREA') {
    let len = edit.html().length;
    edit.focus().autoHeight()[0].setSelectionRange(len, len);
  }
  else edit.select();
  edit.on('keydown', cell, function(evt){
    let cell = evt.data;
    let edit = $(this);
    if ((evt.altKey == true) && (evt.which == 40)) {
      let content = edit.val();
      edit.blur();
      doEdit(cell.parent().next().children().eq(cell.index()).get(0), content);
      return;
    }
    if ((evt.altKey == true) && (evt.which == 38)) {
      let content = edit.val();
      edit.blur();
      doEdit(cell.parent().prev().children().eq(cell.index()).get(0), content);
      return;
    }
    if (edit.prop('nodeName') == 'TEXTAREA') edit.autoHeight();
    if ((evt.which != 9) && (evt.which != 13) && (evt.which != 27) && (evt.which != 38) && (evt.which != 40)) return;
    if ((edit.prop('nodeName') == 'TEXTAREA') && ((evt.which == 13) || (evt.which == 38) || (evt.which == 40))) return;

    if (evt.which == 27) cell.text(content); // Escape
    else checkEdit(cell, edit, content);

    if (evt.which == 38) { // Arrow up
      cell.parent().prev().children().eq(cell.index()).trigger('click');
    }
    else if (evt.which == 40) { // Arrow down
      cell.parent().next().children().eq(cell.index()).trigger('click');
    }
    else if (evt.which == 9) { // Tab
      if (evt.shiftKey) cell.prev().trigger('click');
      else findNextEdit(cell, evt);
    }
    cell.removeClass('lt-editing');
    return false;
  });
  edit.on('blur', cell, function(evt){
    if (!checkEdit(evt.data, $(this), content)) return false;
    evt.data.removeClass('lt-editing');
  });
  if (data.options.edit[c]?.type == 'checkbox') edit.on('input', function() { edit.trigger('blur'); });
  if ((typeof(data.options.edit[c]) == 'object') && data.options.edit[c].type == 'color') {
    $(cell).colpick({
      color: content,
      layout: 'hex',
      onSubmit: function(hsb, hex, rgb, el) {
        edit.val('#' + hex);
        checkEdit(cell, edit, content);
        $(cell).colpickHide();
      }
    }).colpickShow();
    return;
  }
  else edit.focus();
}

function doSelect(el) {
  let input = $(el);
  let src = input.closest('table').attr('id');
  let id = input.closest('tr').data('rowid');
  input.parent().css('background-color', 'red');
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=select&src=${src}`,
    data: { id: id, link: input.prop('checked') },
    dataType: 'json',
    context: input,
    success: function(data) {
      if (data.error) appError(data.error, this);
      else {
        this.parent().css('background-color', '');
        if (tables[src].data.options.trigger) loadOrRefreshCollection($('#' + tables[src].data.options.trigger));
      }
    }
  });
}
function doEditSelect(cell) {
  cell = $(cell);
  if (cell.hasClass('lt-editing')) return;
  cell.addClass('lt-editing');
  let src = cell.closest('table').attr('id');
  let content = cell.text(), c, query;
  if (tables[src].data.options.format) c = cell.closest('tbody').find('.lt-data').index(cell)+1;
  else c = colVisualToReal(tables[src].data, cell.parent().children('.lt-data').index(cell)+1);
  let edit = tables[src].data.options.edit[c];

  let params = { col: c }
  if (lists[edit.query]) {
    params.crc = lists[edit.query].crc;
    loadSelectbox(cell, lists[edit.query], content, edit.required?true:false);
  }
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=selectbox&src=${src}`,
    data: params,
    cache: true,
    dataType: 'json',
    context: cell,
    success: function(data) {
      if (data.error) appError(data.error, cell);
      else if (data.nochange) this.css({ backgroundColor: '' });
      else {
        lists[edit.query] = data;
        loadSelectbox(this, data, content, edit.required?true:false);
        this.css({ backgroundColor: '' });
      }
    }
  });
  cell.css({ backgroundColor: '#ffa0a0' });
}

function loadSelectbox(cell, list, content, required) {
  let oldvalue = null;
  let selectbox = $('<select id="editbox"></select>');
  selectbox.css({ maxWidth: cell.width() + 'px', minHeight: cell.height() + 'px' });
  let selected = 0;
  if (!required) selectbox.append('<option value=""></option>');
  for (let i = 0; list.items[i]; i++) {
    let label = list.items[i][1] + (list.items[i][2]?` (${list.items[i][2]})`:'');
    if (label == content) {
       selectbox.append(`<option value="${list.items[i][0]}" selected>${label}</option>`);
       oldvalue = String(list.items[i][0]);
       selected = 1;
    }
    else selectbox.append(`<option value="${list.items[i][0]}">${label}</option>`);
  }
  cell.empty().append(selectbox);
  if (list.insert) this.append(`<input type="button" class="lt-add-option" value="➕" onclick="addOption(this, ${c});">`);
  if (!selected) selectbox.prop('selectedIndex', -1);
  selectbox.focus();
  if (selectbox[0].showPicker) selectbox[0].showPicker();
  selectbox.on('keydown', cell, function(evt) {
    let cell = evt.data;
    if (evt.which == 27) cell.text(content); // Escape
    else if (evt.which == 13) checkEdit(cell, selectbox, oldvalue); // Enter
    else if (evt.keyCode == 9) { // Tab
      checkEdit(cell, selectbox, oldvalue);
      if (evt.shiftKey) cell.prev().trigger('click');
      else findNextEdit(cell, evt);
    }
    else {
      return true; // Allow default action (for instance list searching)
  //            if (selectbox.data('filter')) {
  //              if (evt.which == 8) selectbox.data('filter', selectbox.data('filter').substring(0, selectbox.data('filter').length-1));
  //              else selectbox.data('filter', selectbox.data('filter') + String.fromCharCode(evt.keyCode));
  //              console.log(selectbox.data('filter'));
  //              selectbox.find('option').each(function() {
  //                let option = $(this);
  //                let regex = new RegExp(option.parent().data('filter'),"i")
  //                if (option.text().search(regex) != -1) option.removeProp('hidden');
  //                else option.prop('hidden', 'hidden');
  //              });
  //            }
  //            else selectbox.data('filter', String.fromCharCode(evt.keyCode));
    }
    cell.removeClass('lt-editing');
    return false;
  });
  selectbox.on('blur', cell, function(evt) {
    checkEdit(evt.data, $(this), oldvalue);
    evt.data.removeClass('lt-editing');
  });
  selectbox.on('click', 'option', function() { this.parentNode.blur(); return false; });
}

function checkRequirements(options, c, value) {
  if (options.edit[c].required === true) {
    if (value === '') {
      alert(`${tr('Field')} ${c} ${tr('may not be empty')}`);
      return false;
    }
  }
  else {
    if (options.edit[c].required.regex) {
      if (value.search(new RegExp(options.edit[c].required.regex)) >= 0) return true;
      if (options.edit[c].required.message) alert(options.edit[c].required.message);
      else alert(`Invalid input for column ${c}`);
      return false;
    }
    else if (value === '') {
      if (options.edit[c].required.message) alert(options.edit[c].required.message);
      else alert(`Column ${c} may not be empty`);
      return false;
    }
  }
  return true;
}

function directEdit(el) {
  let edit = $(el);
  checkEdit(edit.parent(), edit);
}

function checkEdit(cell, edit, oldvalue) {
  let newvalue = edit.val();
  let src = cell.closest('table').attr('id');
  let options = tables[src].data.options, c;
  if (options.format) c = cell.closest('tbody').find('.lt-data').index(cell)+1;
  else c = cell.parent().children('.lt-data').index(cell)+1;
  if (options.edit[c].type == 'checkbox') {
    if (edit.prop('checked')) {
      if (options.edit[c].truevalue) newvalue = options.edit[c].truevalue;
      else newvalue = 'true';
    }
    else {
      if (options.edit[c].falsevalue) newvalue = options.edit[c].falsevalue;
      else newvalue = 'false';
    }
  }
  else if (options.edit[c].type == 'datauri') {
    newvalue = oldvalue; // Yes this is ugly; mea culpa
    oldvalue = null;
  }

  if ((typeof oldvalue == 'undefined') || (newvalue !== oldvalue) || cell.hasClass('lt-notsaved')) {
    if (options.edit[c].required) {
      if (!checkRequirements(options, c, newvalue)) return false;
    }
    let data = { col: c, row: cell.parent().data('rowid'), val: newvalue };
    if (options.sql) data['sql'] = options.sql;
    $.ajax({
      method: 'post',
      url: `${ajaxUrl}?tab=${tab}&mode=inlineedit&src=${src}`,
      data: data,
      dataType: 'json',
      context: cell,
      success: function(data) {
        if (data.error) userError(data.error);
        else {
          if (data.output) {
            if (options.edit[c].output == 'block') {
              let parent = $('#block_' + tables[src].data.block).parent();
              $('#block_' + tables[src].data.block).replaceWith(data.output);
              loadOrRefreshCollection(parent.find('.lt-div,.lt-control'));
              return;
            }
            if (options.edit[c].output == 'location') {
              window.location = data.output;
              return;
            }
            if (options.edit[c].output == 'alert') alert(data.output);
            else if (options.edit[c].output == 'function') {
              if (!options.edit[c].functionname) {
                console.log(`Source ${src} has an edit with output type function without a functionname parameter`);
                return;
              }
              window[options.edit[c].functionname](data.output);
            }
          }

          this.removeClass('lt-notsaved');
          tables[src].data.crc = '-';
          // if (!options.style || !options.style[c]) this.css({ backgroundColor: 'transparent' });
          let r, rows = tables[src].data.rows;
          for (r = 0; r < rows.length; r++) {
            if (rows[r][0] == this.parent().data('rowid')) break;
          }
          if (r == rows.length) console.log('Row not found in table data');
          else {
            if ((data.input == 'true') || (data.input == options.edit[c].truevalue)) data.input = true;
            else if ((data.input == 'false') || (data.input == options.edit[c].falsevalue)) data.input = false;
            if (options.edit[c].query || (!options.edit[c].target && (options.edit[c].length == 2))) data.input = edit.find('option:selected').text();
            if ((data.input === '') && (data.rows[0][c] === null)) data.input = null;

            if (options.edit[c].type == 'datauri'); // Don't update the cell now so that the data-uri is re-rendered by updateRow()
            else rows[r][c] = data.input;
            updateRow(options, this.closest('tbody'), rows[r], data.rows[0]);
            rows[r] = data.rows[0];
            if (options.callbacks && options.callbacks.change) window.setTimeout(options.callbacks.change, 0);
            if (options.trigger) loadOrRefreshCollection($('#' + options.trigger));
            else if (options.edit.trigger) loadOrRefreshCollection($('#' + options.edit.trigger));
            if (options.sum) updateSums(this.closest('table').find('tfoot'), tables[src].data);
            if (options.edit[c].required) {
              if (data.rows[0][c] === null) this.addClass('lt-required-empty');
              else this.removeClass('lt-required-empty');
            }
          }
        }
      }
    });
    if (edit.prop('nodeName') == 'SELECT') cell.text(edit.find('option:selected').text());
    else if (options.edit[c].type == 'password') cell.empty();
    else if (options.edit[c].type == 'datauri') cell.html(tr('Loading...'));
    else if (options.edit[c].show); // Don't update checkbox type 'switch' or show 'always'
    else if ((newvalue == '') && (typeof options.emptycelltext == 'string')) cell.text(options.emptycelltext);
    else cell.text(newvalue);
    // if (!options.style || !options.style[c]) cell.css({ backgroundColor: '#ffa0a0' });
    cell.addClass('lt-notsaved');
  }
  else if (edit.prop('nodeName') == 'SELECT') cell.text(edit.find(`option[value="${oldvalue}"]`).text());
  else {
    if ((oldvalue === '') && (typeof options.emptycelltext == 'string')) cell.text(options.emptycelltext);
    else cell.text(oldvalue);
  }
  return true;
}

function doInsert(el) {
  el = $(el);
  let row = el.closest('.lt-insert');
  let error = '';
  let table = tables[row.closest('table').attr('id')].data;
  let formdata = new FormData();
  for (let input of row.find('input,select,textarea').not(el)) {
    input = $(input);
    if (!input[0].checkValidity()) {
      input.addClass('lt-check-validity');
      if (input.attr('title')) error += input.attr('title') + '\n';
      else if (input.attr('pattern') && input.val()) error += `${input.data('label')} ${tr('contains invalid input')}\n`;
      else error += `${input.data('label')} ${tr('may not be empty')}\n`;
    }
    let value;
    if (input.prop('type') == 'checkbox') value = input.prop('checked');
    else if (input.prop('type') == 'file') value = input[0].files[0];
    else if (input.prop('type') == 'image') value = input[0].files[0];
    else value = input.val();
    if (value === null) value = '';
    input.trigger('input');
    formdata.append(input.prop('name').replace('.', ':'), value);
  };
  if (error) {
    alert(error);
    return;
  }
  if (table.options.insert && table.options.insert.hidden) {
    if (typeof(table.options.insert.hidden[0]) == 'object') { // Multiple hidden fields (array of arrays)
      for (let i = 0; table.options.insert.hidden[i]; i++) processHiddenInsert(formdata, table.options.insert.hidden[i]);
    }
    else processHiddenInsert(formdata, table.options.insert.hidden);
  }
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=insertrow&src=${table.block}:${table.tag}`,
    data: formdata,
    dataType: 'json',
    processData: false,
    contentType: false,
    context: row,
    xhr: function() {
      let xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', function(evt) {
        if (evt.lengthComputable) {
          let pct = Math.round(evt.loaded * 100 / evt.total);
          el.css('background', `linear-gradient(90deg, rgba(0,255,0,1) 0%, rgba(0,255,0,1) ${pct}%, rgba(110,28,32,0) ${pct}%, rgba(0,0,0,0) 100%)`);
        }
      });
      return xhr;
    },
    success: function(data) {
      let table = this.closest('table');
      let tabledata = tables[table.attr('id')].data;
      let insert = tabledata.options.insert;

      if (data.error) {
        el.css('background', 'rgb(255,0,0)');
        userError(data.error);
        return;
      }
      if (data.output) {
        if (insert.output == 'block') {
          let parent = $('#block_' + tabledata.block).parent();
          $('#block_' + tabledata.block).replaceWith(data.output);
          loadOrRefreshCollection(parent.find('.lt-div,.lt-control'));
          return;
        }
        if (insert.output == 'location') {
          window.location = data.output;
          return;
        }
        if (insert.output == 'alert') alert(data.output);
        else if (insert.output == 'function') {
          if (!insert.functionname) {
            console.log(`Source ${tables[src].data.block}:${tables[src].data.tag} has an insert with output type function without a functionname parameter`);
            return;
          }
          window[insert.functionname](data.output);
        }
      }

      if (!tabledata.options.insert || (tabledata.options.insert.noclear !== true)) {
        this.find('input,select,textarea').each(function() {
          let el = $(this);
          if (el.prop('type') == 'button') el.css('background', '');
          else if (el.data('default')) {
            if (el.prop('nodeName') == 'SELECT') el.find('option').contents().filter(function() { return this.nodeValue == el.data('default'); }).parent().prop('selected', true);
            else el.val(el.data('default'));
          }
          else if (el.prop('nodeName') == 'SELECT') el.prop('selectedIndex', -1);
          else if (el.prop('type') == 'date') el.val(new Date().toISOString().slice(0, 10));
          else if (el.prop('type') == 'checkbox') el.prop('checked', false);
          else if (el.hasClass('lt-addoption')) switchToSelect(el);
          else el.val('');
          el.removeClass('lt-check-validity');
        });
      }

      if (data.rows && data.rows.length) {
        let tbody = table.find('tbody');
        if (!tbody.length) {
          tbody = $('<tbody/>');
          table.prepend(tbody);
        }
        let thead = table.find('thead');
        if (!thead.length) {
          thead = $('<thead/>');
          if (tabledata.title && table.closest('.lt-div').data('sub') != 'true') thead.append(renderTitle(tabledata));
          thead.append(renderHeaders(tabledata, table.attr('id')));
          table.prepend(thead);
        }

        updateTable(tbody, tabledata, data.rows);
        tabledata.rows = data.rows;
        tabledata.crc = data.crc;
        if (tabledata.options.sum) updateSums(table.find('tfoot'), tabledata);
      }
      if (tabledata.options.trigger) loadOrRefreshCollection($('#' + tabledata.options.trigger));
      else if (tabledata.options.insert.trigger) loadOrRefreshCollection($('#' + tabledata.options.insert.trigger));
      else if ((tabledata.options.insert.include == 'edit') && tabledata.options.edit.trigger) loadOrRefreshCollection($('#' + tabledata.options.edit.trigger));
      if (tabledata.options.insert.onsuccessalert) alert(tabledata.options.insert.onsuccessalert);
      if (tabledata.options.insert.onsuccessscript) eval(tabledata.options.insert.onsuccessscript);

      this.find('input,select,textarea').first().focus();
    }
  });
}

function doNext(el, prev) {
  let div = $(el).closest('div');
  let src = div.data('source');
  let options = tables[src].options;

  if (options.prev || options.next) {
    let data = { prev: prev || false };
    if (options.fields) {
      for (let field of options.fields) {
        data['field_' + field[0]] = div.find(`.lt-control-field[name=${field[0]}]`).val();
      }
    }
    $.ajax({
      method: 'post',
      url: `${ajaxUrl}?tab=${tab}&mode=donext&src=${src}`,
      data: data,
      dataType: 'json',
      success: function(data) {
        if (data.error) {
          userError(data.error);
          return;
        }
        if (options.runjs) eval(options.runjs);
        if (data.replace) {
          let parent = $('#block_' + src.split(':')[0]).parent();
          $('#block_' + src.split(':')[0]).replaceWith(data.replace);
          loadOrRefreshCollection(parent.find('.lt-div,.lt-control'));
        }
        else if (data.location) {
          window.location = data.location;
        }
      }
    });
  }
}

function processHiddenInsert(formdata, hidden) {
  if (!hidden.target || !hidden.value) appError('No target or value defined in insert hidden');
  formdata.append(hidden.target.replace('.', ':'), hidden.value);
}

function doDelete(el) {
  el = $(el);
  let rowid = el.closest('tr').data('rowid');
  let table = tables[el.closest('table').attr('id')].data;
  if (table.options.delete.confirm) {
    let r;
    for (r = 0; r < table.rows.length; r++) {
      if (table.rows[r][0] == rowid) break;
    }
    if (r == table.rows.length) {
      appError('Row to be deleted not found', table.rows);
      return;
    }
    if (!confirm(replaceHashes(table.options.delete.confirm, table.rows[r]))) return;
  }
  $.ajax({
    method: 'post',
    url: `${ajaxUrl}?tab=${tab}&mode=deleterow&src=${table.block}:${table.tag}`,
    data: { id: rowid },
    dataType: 'json',
    context: el.closest('tbody'),
    success: function(data) {
      if (data.error) userError(data.error);
      else {
        let r;
        let newrows = table.rows.slice();
        for (r = 0; r < newrows.length; r++) {
          if (newrows[r][0] == rowid) break;
        }
        if (r == newrows.length) {
          appError('Deleted row not found', newrows);
          return;
        }
        newrows.splice(r, 1);
        updateTable(this, table, newrows);
        table.rows = newrows;
        table.crc = data.crc;
        if (table.options.sum) updateSums(this.parent().find('tfoot'), table);
        if (table.options.trigger) loadOrRefreshCollection($('#'+table.options.trigger));
      }
    }
  });
}

function findNextEdit(el, evt) {
  while (el.next().length > 0) {
    if (el.next().hasClass('lt-edit')) {
      el.next().trigger('click');
//      el.next().scrollIntoViewLazy();
      return;
    }
    if (el.next().hasClass('form')) {
      el.next().children(':first').focus();
//      el.next().scrollIntoViewLazy();
      el.removeClass('lt-editing');
      return;
    }
    el = el.next();
  }
  el.removeClass('lt-editing');
}


/* * * * * * * * * * * * *
 *                       *
 *   3rd-party scripts   *
 *                       *
 * * * * * * * * * * * * */

 jQuery.fn.extend({
  autoHeight: function () {
    function autoHeight_(element) {
      return jQuery(element)
        .css({ "height": "auto", "overflow-y": "hidden" })
        .height(element.scrollHeight);
    }
    return this.each(function() {
      autoHeight_(this).on("input", function() {
        autoHeight_(this);
      });
    });
  }
});
