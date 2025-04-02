<?php

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

require('libtables.php');

global $dbh;
global $tab;
global $lt_settings;

if (isset($lt_settings['access_control'])) {
  if (isset($lt_settings['access_control']['lt_var'])) {
    if (!lt_isvar($lt_settings['access_control']['lt_var'])) fatalerr("You are not logged in");
  }
}

function fatalerr($msg, $redirect = "") {
  $ret['error'] = $msg;
  if (!empty($lt_settings['error_rewrite'])) {
    foreach ($lt_settings['error_rewrite'] as $key => $value) {
      if ($key[0] != '/') {
        if (strpos($msg, $key) !== FALSE) {
          $ret['error'] = $value;
          $ret['details'] = $msg;
        }
      }
      else {
        $res = preg_match($key, $msg);
        if ($res === false) error_log("Regular expression syntax error in error_rewrite entry '$key'");
        if ($res) {
          $ret['error'] = preg_replace($key, $value, $msg);
          $ret['details'] = $msg;
        }
      }
    }
  }
  if (!empty($redirect)) $ret['redirect'] = $redirect;
  header('Content-type: application/json; charset=utf-8');
  print json_encode($ret, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PARTIAL_OUTPUT_ON_ERROR);
  exit;
}

function lt_find_table($src) {
  global $lt_settings;
  global $tables;
  global $mch; // May be used in block definitions
  global $parseonly;
  $tables = [];
  $parseonly = true;

  $src = explode(':', $src);
  if (is_array($lt_settings['blocks_dir'])) $dirs = $lt_settings['blocks_dir'];
  else $dirs[] = $lt_settings['blocks_dir'];

  foreach($dirs as $dir) {
    if (file_exists($dir . $src[0] . '.yml')) {
      $yaml = yaml_parse_file($dir . $src[0] . '.yml', -1);
      if ($yaml === false) fatalerr('YAML syntax error in block ' . $src[0]);
      else {
        $n = 0;
        foreach ($yaml as $item) {
          if (is_null($item)) continue;
          if (is_string($item)) continue;
          $n += 1;
          if (!isset($item['type'])) {
            if (isset($item['columns'])) $item['type'] = 'insert';
            elseif (isset($item['format'])) $item['type'] = 'text';
            elseif (isset($item['query'])) $item['type'] = 'table';
            else $item['type'] = 'control';
          }
          if (!isset($item['tag'])) $item['tag'] = "$n";
          if (!isset($item['title'])) $item['title'] = null;
          if (!isset($item['options'])) $item['options'] = [];
          $tables[] = $item;
        }
      }
      break;
    }
  }

  if (!empty($error)) fatalerr($error, $redirect);
  if (count($tables) == 0) fatalerr('Source ' . $src[0] . ':' . $src[1] . ' not found');

  $table = 0;
  foreach ($tables as $atable) {
    if (isset($atable['tag']) && ($atable['tag'] === $src[1])) {
      $atable['block'] = $src[0];
      if (!empty($lt_settings['default_options'])) $atable['options'] = array_merge($lt_settings['default_options'], $atable['options']);
      return $atable;
    }
  }
  fatalerr('Table ' . $src[1] . ' not found in block ' . $src[0]);
}

function lt_find_pk_column($table) {
  global $lt_settings;
  if (!empty($lt_settings['pk_columns']) && !empty($lt_settings['pk_columns'][$table])) return $lt_settings['pk_columns'][$table];
  return 'id';
}

// function lt_remove_parens($str) {
//   $c = 0;
//   $ret = "";
//   for ($i = 0; $i < strlen($str); $i++) {
//     if ($str[$i] == '(') $c++;
//     elseif ($str[$i] == ')') {
//       $c--;
//       continue;
//     }
//     if ($c == 0) $ret .= $str[$i];
//   }
//   return $ret;
// }
// function lt_edit_from_query($query) {
//   if (!preg_match('/^\s*SELECT (.*) FROM (\S+)(.*)$/i', $_POST['sql'], $matches)) return false;
//   $cols = preg_split('/\s*,\s*/', lt_remove_parens($matches[1]));
//   $firsttable = $matches[2];
//   preg_match_all('/JOIN\s+([^ ]+)\s+ON\s+([^ .]+\.[^ ]+)\s*=\s*([^ .]+\.[^ ]+)/i', $matches[3], $sets, PREG_SET_ORDER);
//   foreach ($sets as $set) {
//     $left = explode('.', $set[2]);
//     $right = explode('.', $set[3]);
//     if (($left[0] == $set[1]) && ($left[1] == 'id') && ($right[0] == $firsttable)) $joins[$set[1]] = [ 'pk' => $set[2], 'fk' => $set[3] ];
//     elseif (($right[1] == 'id') && ($left[0] == $firsttable)) $joins[$set[1]] = [ 'pk' => $set[3], 'fk' => $set[2] ];
//   }
//   for ($i = 0; $i < count($cols); $i++) {
//     if (strpos($cols[$i], '.') === false) continue;
//     $val = explode('.', $cols[$i]);
//     if ($val[0] == $firsttable) {
//       if ($i) $edit[$i] = $cols[$i];
//     }
//     elseif ($i == 0) return false;
//     elseif ($joins[$val[0]]) {
//       $edit[$i] = [ $joins[$val[0]]['fk'], 'SELECT id, ' . $val[1] . ' FROM ' . $val[0] ];
//     }
//   }
//   return $edit;
// }

function replaceHashes($str, $row) {
  if (empty($row)) return $str;
  $str = str_replace('#id', $row[0], $str);
  if (strpos($str, '#') !== FALSE) {
    for ($i = count($row)-1; $i >= 0; $i--) $str = str_replace('#' . $i, $row[$i], $str);
  }
  return $str;
}

function arrayCondition($condition, $row) {
  $left = replaceHashes($condition[0], $row);
  $right = replaceHashes($condition[2], $row);
  switch ($condition[1]) {
    case '==': return ($left == $right);
    case '!=': return ($left != $right);
    case '<=': return ($left <= $right);
    case '<': return ($left < $right);
    case '>=': return ($left >= $right);
    case '>': return ($left > $right);
    case 'regex':
      $res = preg_match($right, $left);
      if ($res === FALSE) error_log('Invalid regex in rowaction condition');
      return $res;
    case '!regex':
      $res = preg_match($right, $left);
      if ($res === FALSE) error_log('Invalid regex in rowaction condition');
      return ($res === 0);
    default: error_log('Invalid comparison in rowaction condition');
  }
}

function lt_audit($mode, $table, $row, $column, $oldval, $newval) {
  global $lt_settings;
  global $dbh;

  if (empty($lt_settings['audit_log'])) return;
  if (empty($lt_settings['audit_log']['table'])) {
    error_log('Libtables: $lt_settings[\'audit_log\'] is defined but has no "table" entry');
    return;
  }
  if (empty($lt_settings['audit_log']['fields'])) {
    error_log('Libtables: $lt_settings[\'audit_log\'] is defined but has no "fields" entry');
    return;
  }

  if (!empty($lt_settings['audit_log']['extra'])) {
    $fields = array_merge(array_keys($lt_settings['audit_log']['extra']), $lt_settings['audit_log']['fields']);
  }
  else $fields = $lt_settings['audit_log']['fields'];

  if (!($stmt = $dbh->prepare('INSERT INTO ' . $lt_settings['audit_log']['table'] . ' ("' . implode('", "', $fields) . '") VALUES (?' . str_repeat(', ?', count($fields)-1) . ')'))) {
    error_log('Libtables: statement prepare failed for audit_log');
    return;
  }
  $args = [ $mode, $table, $row, $column, $oldval, $newval ];
  if (!empty($lt_settings['audit_log']['extra'])) $args = array_merge(array_values($lt_settings['audit_log']['extra']), $args);
  if (!$stmt->execute(array_slice($args, 0, count($fields)))) {
    error_log('Libtables: statement execute failed for audit_log: ' . $stmt->errorInfo()[2]);
    return;
  }
}

function lt_run_insert($table, $data, $idcolumn = '') {
  global $dbh;
  $driver = $dbh->getAttribute(\PDO::ATTR_DRIVER_NAME);

  $values_str = "";
  foreach (array_keys($data['columns']) as $column) {
    if (!empty($data['sqlfunction'][$column])) $values_str .= $data['sqlfunction'][$column] . ", ";
    else $values_str .= "?, ";
  }
  $query = "INSERT INTO $table (" . implode(',', array_keys($data['columns'])) . ") VALUES (" . rtrim($values_str, ', ') . ")";
  $values = array_values($data['columns']);
  if (!empty($data['onconflict'])) {
    $str = $data['onconflict'];
    while (preg_match("/[ (,]#([a-zA-Z0-9_]+)/", $str, $matches, PREG_OFFSET_CAPTURE)) {
      $match = $matches[1];
      if (!isset($data['columns'][$match[0]])) {
        error_log('Libtables error: insert field \'' . $match[0] . '\' used in onconflict option not found');
        continue;
      }
      $str = substr_replace($str, '?', $match[1]-1, strlen($match[0])+1);
      $values[] = $data['columns'][$match[0]];
    }
    while (preg_match("/[ (,]:([a-z_]+)/", $str, $matches, PREG_OFFSET_CAPTURE)) {
      $match = $matches[1];
      if (!lt_isvar($match[0])) {
        error_log('Libtables error: lt_var \'' . $match[0] . '\' used in onconflict option not found');
        continue;
      }
      $str = substr_replace($str, '?', $match[1]-1, strlen($match[0])+1);
      $values[] = lt_getvar($match[0]);
    }
    $query .= ' ' . $str;
  }
  if ($idcolumn && ($driver == 'pgsql')) $query .= " RETURNING $idcolumn";

  if (!($stmt = $dbh->prepare($query))) {
    fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
  }
  if (!($stmt->execute($values))) {
    fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
  }

  if ($idcolumn) {
    if ($driver == 'pgsql') {
      $row = $stmt->fetch(\PDO::FETCH_NUM);
      if (empty($row) || empty($row[0])) fatalerr("lastInsertId requested but not available");
      $id = $row[0];
    }
    else $id = $dbh->lastInsertId();
  }
  else $id = 0;

  return $id;
}

function doEditInsertRuns($item, $id, $val = null) {
  $ret = [];
  $lt_sqloutput = '';
  $lt_phpoutput = '';
  $lt_blockoutput = '';
  lt_setvar('lt_id', $id, true);
  lt_setvar('lt_val', $val, true);
  if (empty($item['runorder'])) $item['runorder'] = [ 'sql', 'php', 'block' ];
  foreach ($item['runorder'] as $run) {
    switch ($run) {
      case 'sql':
        if (!empty($item['runsql'])) {
          $lt_sqloutput = lt_query_single($item['runsql'], [ 'lt_phpoutput' => $lt_phpoutput, 'lt_blockoutput' => $lt_blockoutput ]);
          $ret['output'] = $lt_sqloutput;
        }
        break;
      case 'php':
        if (!empty($item['runphp'])) {
          try {
            ob_start();
            eval($item['runphp']);
            $lt_phpoutput = ob_get_clean();
            $ret['output'] = $lt_phpoutput;
          } catch (Exception $e) {
            $ret['error'] = "PHP error in runphp: " . $e->getMessage();
          }
        }
        break;
      case 'block':
        if (!empty($item['runblock'])) {
          ob_start();
          lt_print_block($item['runblock'], [ 'nowrapper' => (($item['output']??null)=='block'?false:true) ]);
          $lt_blockoutput = ob_get_clean();
          $ret['output'] = $lt_blockoutput;
        }
        break;
      default:
        error_log('Invalid runorder option "$run" in block ' . $_GET['src']);
    }
  }
  lt_setvar('lt_id', NULL, true);
  lt_setvar('lt_val', NULL, true);
  return $ret;
}

if (empty($_GET['mode'])) fatalerr('No mode specified');
if (empty($_GET['src']) || !preg_match('/^[a-z0-9_-]+:[a-z0-9_-]+$/', $_GET['src'])) fatalerr('Invalid source specified');
if (empty($_GET['tab'])) fatalerr('No tab specified');
$tab = $_GET['tab'];

switch ($_GET['mode']) {
  case 'getblock':
    if (empty($_GET['block'])) fatalerr('No blockname specified in mode getblock');
    if (preg_match('/(\.\.|\\|\/)/', $_GET['block'])) fatalerr('Invalid blockname in mode getblock');
    header('Content-type: text/html; charset=utf-8');
    lt_print_block($_GET['block'], [ 'nowrapper' => true ]);
    exit; // All other cases break and print JSON at the end
  // case 'transl':
  //   if (empty($lt_settings['transl_query'])) {
  //     $ret = '{}';
  //     break;
  //   }
  //   $data = lt_query($lt_settings['transl_query']);
  //   if (!empty($data['error'])) fatalerr($data['error']);
  //   $ret = [ 'strings' => $data['rows'] ];
  //   break;
  case 'gettable':
    $table = lt_find_table($_GET['src']);
    $ret = prepare_table($table);
    if (!empty($ret['error'])) fatalerr($ret['error']);
    break;
  case 'refreshtable':
    if (empty($_POST['crc'])) fatalerr('No crc passed in mode refreshtable');

    $table = lt_find_table($_GET['src']);
    if (strpos($table['query'], 'WHERE FALSE') && !empty($_SESSION['search_' . $table['block'] . '_' . $table['tag'] . '_where'])) {
      if (empty($_SESSION['search_' . $table['block'] . '_limit'])) $limit = '';
      else $limit = ' LIMIT ' . $_SESSION['search_' . $table['block'] . '_limit'];
      $ret = lt_query(
        str_replace(
          'WHERE FALSE',
          'WHERE ' . $_SESSION['search_' . $table['block'] . '_' . $table['tag'] . '_where'], $table['query']
        ) . $limit,
        0,
        $_SESSION['search_' . $table['block'] . '_' . $table['tag'] . '_values']
      );
      if ($limit && !empty($ret['rows']) && count($ret['rows']) == $_SESSION['search_' . $table['block'] . '_limit']) {
        $ret['total'] = lt_query_single("SELECT count(*) FROM (" .
          str_replace(
            'WHERE FALSE',
            'WHERE ' . $_SESSION['search_' . $table['block'] . '_' . $table['tag'] . '_where'], $table['query']
          ) .
        ") as sub", $_SESSION['search_' . $table['block'] . '_' . $table['tag'] . '_values']);
      }
    }
    else $ret = lt_query($table['query']);
    if (isset($ret['error'])) fatalerr('Query for table ' . $table['title'] . ' in block ' . $src[0] . ' returned error: ' . $data['error']);
    if (empty($lt_settings['checksum']) || ($lt_settings['checksum'] == 'php')) $crc = crc32(json_encode($ret['rows'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PARTIAL_OUTPUT_ON_ERROR));
    elseif ($lt_settings['checksum'] == 'psql') $crc = lt_query_single("SELECT md5(string_agg(q::text, '')) FROM (" . $table['query'] . ") AS q)");
    if ($crc == $_POST['crc']) $ret = [ 'nochange' => 1 ]; // Overwrite output from lt_query since we don't need it
    else $ret['crc'] = $crc;

    if (!empty($table['options']['titlequery'])) $ret['title'] = lt_query_single($table['options']['titlequery']);
    elseif (!is_null($table['title']) && (strpos($table['title'], ':') !== false)) $ret['title'] = lt_replace_params($table['title']);
    if (!empty($table['options']['tableaction']['sqlcondition'])) $ret['options']['tableaction']['sqlcondition'] = (lt_query_count($table['options']['tableaction']['sqlcondition']) > 0);
    break;
  case 'getsearch':
    if (empty($_POST['name'])) fatalerr('Invalid name in mode getsearch');

    $ret = [];
    $search = lt_find_table($_GET['src']);
    foreach ($search['options']['fields'] as $field) {
      if ($field['name'] == $_POST['name']) {
        $params = [];
        if (!empty($field['depends'])) {
          foreach ($field['depends'] as $param) {
            if (isset($_POST['param_'.$param])) $params[$param] = $_POST['param_'.$param];
          }
        }
        if (!empty($field['query'])) $ret['options'] = lt_query_rows($field['query'], $params);
        break;
      }
    }
    if (!empty($ret['error'])) fatalerr($ret['error']);
    break;
  case 'search':
    $search = lt_find_table($_GET['src']);
    if (empty($_POST['fields'])) {
      unset($_SESSION['search_' . $search['block'] . '_' . $search['options']['target'] . '_where']);
      unset($_SESSION['search_' . $search['block'] . '_' . $search['options']['target'] . '_values']);
      unset($_SESSION['search_' . $search['block'] . '_limit']);
      $ret = [ 'status' => 'ok' ];
      break;
    }
    $where = '';
    $values = [];
    foreach ($_POST['fields'] as $field) {
      if (empty($field['name'])) fatalerr('No field name specified in mode search');
      foreach ($search['options']['fields'] as $config) {
        if ($config['name'] == $field['name']) { break; }
        $config = null;
      }
      if (!$config) fatalerr('Field "' . $field['name'] . '" not found in config in mode search');
      if (!empty($where)) $where .= ' AND ';
      if (isset($config['multiple'])) {
        $where .= $config['column'] . ' = ANY(:' . $field['name'] . ')';
        $values[$field['name']] = '{' . implode(',', $field['value']) . '}';
      }
      elseif (isset($config['fullmatch']) && (($config['fullmatch'] === true) || ($field['fullmatch'] === 'true'))) {
        $where .= $config['column'] . ' = :' . $field['name'];
        $values[$field['name']] = trim($field['value']);
      }
      elseif (isset($config['fts']) && (($config['fts'] === true) || ($field['fts'] === 'true'))) {
        $where .= $config['column'] . ' @@ websearch_to_tsquery(\'dutch\', :' . $field['name'] . ')';
        $values[$field['name']] = $field['value'];
      }
      else {
        $where .= $config['column'] . ' ilike :' . $field['name'];
        $values[$field['name']] = '%' . str_replace([ "'", ' ', '.' ], '%', trim($field['value'])) . '%';
      }
    }
    $_SESSION['search_' . $search['block'] . '_' . $search['options']['target'] . '_where'] = $where;
    $_SESSION['search_' . $search['block'] . '_' . $search['options']['target'] . '_values'] = $values;
    if (!empty($_POST['limit']) && is_numeric($_POST['limit'])) {
      $_SESSION['search_' . $search['block'] . '_limit'] = $_POST['limit'];
    }
    $ret = [ 'status' => 'ok', 'where' => $where ];
    break;
  case 'refreshtext':
    $table = lt_find_table($_GET['src']);
    $ret['text'] = lt_query_to_string($table['query'], $table['format']);
    break;
  case 'select':
    if (empty($_POST['id']) || !is_numeric($_POST['id'])) fatalerr('Invalid row id in mode select');
    if (empty($_POST['link'])) fatalerr('Invalid link data in mode select');

    $table = lt_find_table($_GET['src']);
    if (empty($table['options']['selectany'])) fatalerr('No selectany option found for table ' . $_GET['src']);
    if (empty($table['options']['selectany']['linktable'])) fatalerr('No linktable found for table ' . $_GET['src']);
    if (empty($table['options']['selectany']['fields'][0])) fatalerr('No left field found for table ' . $_GET['src']);
    if (empty($table['options']['selectany']['fields'][1])) fatalerr('No right field found for table ' . $_GET['src']);

    if ($_POST['link'] === "true") {
      if (!($stmt = $dbh->prepare("INSERT INTO " . $table['options']['selectany']['linktable'] . " (" . $table['options']['selectany']['fields'][0] . ", " . $table['options']['selectany']['fields'][1] . ") VALUES (" . $table['options']['selectany']['id'] . ", " . $_POST['id'] . ")"))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!$stmt->execute()) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
    }
    else {
      if (!($stmt = $dbh->prepare("DELETE FROM " . $table['options']['selectany']['linktable'] . " WHERE " . $table['options']['selectany']['fields'][0] . " = " . $table['options']['selectany']['id'] . " AND " . $table['options']['selectany']['fields'][1] . " = " . $_POST['id']))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!$stmt->execute()) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
    }
    $ret = '{ "status": "ok" }';
    break;
  case 'inlineedit':
    if (empty($_POST['col']) || !is_numeric($_POST['col'])) fatalerr('Invalid column id in mode inlineedit');
    if (empty($_POST['row']) || !is_numeric($_POST['row'])) fatalerr('Invalid row id in mode inlineedit');
    if (!isset($_POST['val'])) fatalerr('No value specified in mode inlineedit');

    $table = lt_find_table($_GET['src']);
    if (empty($table['options']['edit'][$_POST['col']])) fatalerr('No edit option found for column ' . $_POST['col'] . ' in table ' . $_GET['src']);
    $edit = $table['options']['edit'][$_POST['col']];

    $type = 'default';
    if (is_array($edit)) {
      if (empty($edit)) fatalerr('Invalid edit settings for column ' . $_POST['col'] . ' in table ' . $_GET['src']);
      if (!empty($edit['type'])) $type = $edit['type'];
      if (!empty($edit['target'])) $target = $edit['target'];
      else $target = $edit[0];
    }
    else $target = $edit;

    if (!preg_match('/^[a-z0-9_-]+\.[a-z0-9_-]+$/', $target)) fatalerr('Invalid target specified for column ' . $_POST['col'] . ' in table ' . $_GET['src'] . ' (' . $target . ')');
    $target = explode('.', $target);

    if ($_POST['val'] == '') {
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = NULL WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, NULL);
    }
    elseif (($type == 'checkbox') && !empty($edit['truevalue']) && ($edit['truevalue'] === $_POST['val'])) {
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = TRUE WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, TRUE);
    }
    elseif (($type == 'checkbox') && !empty($edit['falsevalue']) && ($edit['falsevalue'] === $_POST['val'])) {
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = FALSE WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, FALSE);
    }
    elseif (!empty($edit['phpfunction'])) {
      // $data = lt_query($table['query'], $_POST['row']);
      // if (!empty($data['error'])) fatalerr($data['error']);
      // $func = 'return ' . str_replace('?', "'" . $_POST['val'] . "'", replaceHashes($edit['phpfunction'], $data['rows'][0])) . ';';
      $func = 'return ' . str_replace('?', "'" . $_POST['val'] . "'", replaceHashes($edit['phpfunction'], $data['rows'][0])) . ';';
      $ret = eval($func);
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = ? WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $ret, $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, $ret);
    }
    elseif (!empty($edit['sqlfunction'])) {
      if (strpos($edit['sqlfunction'], '#') >= 0) {
        $data = lt_query($table['query'], $_POST['row']);
        // Do search-and-replace of # here
        if (!empty($data['error'])) fatalerr($data['error']);
        $sqlfunc = str_replace('#id', $data['rows'][0][0], $edit['sqlfunction']);
        for ($i = count($data['rows'][0]); $i >= 0; $i--) {
          if ((strpos($sqlfunc, '#'.$i) >= 0) && isset($data['rows'][0][$i])) $sqlfunc = str_replace('#'.$i, $data['rows'][0][$i], $sqlfunc);
        }
      }
      else $sqlfunc = $edit['sqlfunction'];
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = ' . $sqlfunc . ' WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['val'], $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, $sqlfunc);
    }
    else {
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = ? WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['val'], $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, $_POST['val']);
    }

    if (!empty($edit['sub'])) {
      $target[1] = $edit['sub'];
      if (!($stmt = $dbh->prepare('UPDATE ' . $target[0] . ' SET ' . $target[1] . ' = NULL WHERE ' . lt_find_pk_column($target[0]) . ' = ?'))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['row'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target[0], $_POST['row'], $target[1], NULL, NULL);
    }

    $ret = is_array($edit)?doEditInsertRuns($edit, $_POST['row'], $_POST['val']):[];
    $ret += lt_query($table['query'], $_POST['row']);
    if (isset($ret['error'])) fatalerr('Query for table ' . $table['title'] . ' in block ' . $src[0] . " returned error:\n\n" . $ret['error']);
    $ret['input'] = $_POST['val'];
    break;
  case 'selectbox':
    if (empty($_POST['col']) || !is_numeric($_POST['col'])) fatalerr('Invalid column id in mode selectbox');

    $table = lt_find_table($_GET['src']);
    $edit = $table['options']['edit'];

    if (!empty($edit[$_POST['col']])) $edit = $edit[$_POST['col']];
    elseif (!empty($table['options']['insert']) && !empty($table['options']['insert'][$_POST['col']])) $edit = $table['options']['insert'][$_POST['col']];
    else fatalerr('No edit option found for column ' . $_POST['col'] . ' in table ' . $_GET['src']);

    if (!is_array($edit)) fatalerr('No editselect option found for column ' . $_POST['col'] . ' in table ' . $_GET['src']);
    if (count($edit) < 2) fatalerr('No valid editselect option found for column ' . $_POST['col'] . ' in table ' . $_GET['src']);
    if (!empty($edit['target'])) $target = $edit['target'];
    else $target = $edit[0];
    if (!empty($edit['query'])) $query = $edit['query'];
    else $query = $edit[1];
    if (!preg_match('/^[a-z0-9_-]+\.[a-z0-9_-]+$/', $target)) fatalerr('Invalid target specified for column ' . $_POST['col'] . ' in table ' . $_GET['src'] . ' (' . $target . ')');
    $target = explode('.', $target);

    $ret = get_selectoptions($query);
    if (!empty($ret['error'])) break;
    if (!empty($_POST['crc']) && ($_POST['crc'] == $ret['crc'])) {
      $ret = '{ "nochange": 1 }';
      break;
    }
    if (!empty($edit['insert']) || !empty($edit[2])) $ret['insert'] = true;
    break;
  case 'action':
    if (empty($_POST['type'])) fatalerr('No type specified for mode action');

    $table = lt_find_table($_GET['src']);
    if ($_POST['type'] == 'table') {
      if (empty($table['options']['tableaction'])) fatalerr('No table action defined in block ' . $_GET['src']);
      $action = $table['options']['tableaction'];
      $ret['row'] = [];
      if (!empty($_POST['params'])) {
        $params = json_decode(base64_decode($_POST['params']));
        $count = 0;
        foreach ($params as $param) {
          $count++;
          lt_setvar('lt_param' . $count, $param, true);
        }
      }
    }
    else if ($_POST['type'] == 'row') {
      if (empty($table['options']['rowaction'])) fatalerr('No actions defined in block ' . $_GET['src']);
      if (!isset($_POST['action'])) fatalerr('No action id passed in mode action in block ' . $_GET['src']);
      if (empty($table['options']['rowaction'][intval($_POST['action'])])) {
        if (!empty($table['options']['rowaction']['text'])) $action = $table['options']['rowaction'];
        else fatalerr('Action #' . $_POST['action'] . ' not found for table ' . $_GET['src']);
      }
      else $action = $table['options']['rowaction'][intval($_POST['action'])];
      if (empty($_POST['row'])) fatalerr('No row id passed in mode action in block ' . $_GET['src']);
      if (!is_numeric($_POST['row'])) fatalerr('Invalid row id passed in mode action in block ' . $_GET['src']);
      $id = intval($_POST['row']);
      $data = lt_query($table['query'], $id);
      if (empty($data['rows'])) fatalerr('Row with id ' . $_POST['row'] . ' not found in mode action in block ' . $_GET['src']);
      $ret['row'] = $data['rows'][0];
    }
    else fatalerr('Invalid type in mode action');

    if (!empty($action['condition'])) {
      if (!arrayCondition($action['condition'], $ret['row'])) {
        if (!empty($action['condition'][3])) $ret['usererror'] = $action['condition'][3];
        else $ret['usererror'] = 'Action currently not available';
        break;
      }
    }

    if (!empty($action['setvar'])) {
      foreach ($action['setvar'] as $name => $value) {
        if ($name === 0) fatalerr('rowaction setvar value needs to be an object, not an array');
        lt_setvar(replaceHashes($name, $ret['row']) . ':' . $tab, replaceHashes($value, $ret['row']));
      }
    }

    $lt_sqloutput = '';
    $lt_phpoutput = '';
    $lt_blockoutput = '';
    if (empty($action['runorder'])) $action['runorder'] = [ 'sql', 'php', 'block' ];
    foreach ($action['runorder'] as $run) {
      switch ($run) {
        case 'sql':
          if (!empty($action['runsql'])) {
            $lt_sqloutput = lt_query_single(replaceHashes($action['runsql'], $ret['row']), [ 'lt_phpoutput' => $lt_phpoutput, 'lt_blockoutput' => $lt_blockoutput ]);
            $ret['output'] = $lt_sqloutput;
          }
          break;
        case 'php':
          if (!empty($action['runphp'])) {
            try {
              ob_start();
              eval(replaceHashes($action['runphp'], $ret['row']));
              $lt_phpoutput = ob_get_clean();
              $ret['output'] = $lt_phpoutput;
            } catch (Exception $e) {
              $ret['error'] = "PHP error in row action runphp: " . $e->getMessage();
            }
          }
          break;
        case 'block':
          if (!empty($action['runblock'])) {
            ob_start();
            lt_print_block(replaceHashes($action['runblock'], $ret['row']), [ 'nowrapper' => (($action['output']??null)=='block'?false:true) ]);
            $lt_blockoutput = ob_get_clean();
            $ret['output'] = $lt_blockoutput;
          }
          break;
        default:
          error_log('Invalid runorder option "$run" in action in block ' . $_GET['src']);
      }
    }
    break;
  case 'excelexport':
    include('3rdparty/xlsxwriter.class.php');

    $table = lt_find_table($_GET['src']);
    $data = lt_query($table['query']);
    if (isset($data['error'])) fatalerr('Query for table ' . $table['title'] . ' in block ' . $src[0] . ' returned error: ' . $data['error']);
    $types = str_replace([ 'int4', 'int8', 'float4', 'float8', 'bool', 'text' ], [ 'integer', 'integer', '#,##0.00', '#,##0.00', 'integer', 'string' ], $data['types']);
    $headers = array_combine($data['headers'], $types);
    $writer = new \XLSXWriter();
    if (!empty($table['options']['export']['hideid']) && $table['options']['export']['hideid']) array_shift($headers);
    $writer->writeSheetHeader('Sheet1', $headers, [ 'font-style' => 'bold', 'border' => 'bottom' ]);
    foreach ($data['rows'] as $row) {
      if (!empty($table['options']['export']['hideid']) && $table['options']['export']['hideid']) array_shift($row);
      $writer->writeSheetRow('Sheet1', $row);
    }
    header('Content-disposition: attachment; filename="'.\XLSXWriter::sanitize_filename($table['title'] . '.xlsx').'"');
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Transfer-Encoding: binary');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    $writer->writeToStdOut();
    exit;
  case 'addoption':
    if (empty($_POST['col']) || !is_numeric($_POST['col'])) fatalerr('No (valid) column value passed in mode addoption');
    if (empty($_POST['option'])) fatalerr('No option value passed in mode addoption');
    $table = lt_find_table($_GET['src']);
    if (empty($table['options']['insert'])) fatalerr('Table ' . $_GET['src'] . ' has no insert option configured');
    if (!empty($table['options']['insert'][$_POST['col']])) $edit = $table['options']['insert'][$_POST['col']];
    elseif (!empty($table['options']['insert']['include']) && ($table['options']['insert']['include'] == 'edit') && !empty($table['options']['edit'][$_POST['col']])) {
      $edit = $table['options']['edit'][$_POST['col']];
    }
    else fatalerr('No matching insert/edit option found for table ' . $_GET['src'] . ' column ' . $_POST['col'] . ' in mode addoption');
    if (!empty($edit['insert'])) $insert = $edit['insert'];
    elseif (!empty($edit[2])) $insert = $edit[2];
    else fatalerr('No insert suboption within select option of table ' . $_GET['src'] . ' column ' . $_POST['col'] . ' in mode addoption');
    if (!empty($insert['idcolumn']) && !empty($insert['valuecolumn'])) {
      list($idtable, $idcolumn) = explode('.', $insert['idcolumn']);
      list($valuetable, $valuecolumn) = explode('.', $insert['valuecolumn']);
    }
    elseif (!empty($insert[0]) && !empty($insert[1])) {
      list($idtable, $idcolumn) = explode('.', $insert[0]);
      list($valuetable, $valuecolumn) = explode('.', $insert[1]);
    }
    else fatalerr('Invalid insert suboption found within select option of table ' . $_GET['src'] . ' column ' . $_POST['col'] . ' in mode addoption');
    if (!$idtable || !$idcolumn || !$valuetable || !$valuecolumn) fatalerr('Invalid data found in insert suboption within select option of table ' . $_GET['src'] . ' column ' . $_POST['col'] . ' in mode addoption');
    if ($idtable != $valuetable) fatalerr('Different id and value tables specified in insert suboption within select option of table ' . $_GET['src'] . ' column ' . $_POST['col'] . ' in mode addoption');
    $query['columns'][$valuecolumn] = $_POST['option'];
    $ret['insertid'] = lt_run_insert($idtable, $query, $idcolumn);
    break;
  case 'insertrow':
    $tableinfo = lt_find_table($_GET['src']);

    // Process the $_POST variables into a table -> column -> value multidimensional array
    $tables = [];
    foreach ($_POST as $key => $value) {
      if (strpos($key, ':')) {
        list($table, $column) = explode(':', $key);
        if (!$table || !$column) fatalerr('<p>Incorrect target specification in mode insert: ' . $key);
        if ($value === "") {
          // Check required fields here
        }
        else $tables[$table]['columns'][$column] = $value;
      }
    }
    foreach ($_FILES as $key => $value) {
      if (strpos($key, ':') === FALSE) fatalerr('<p>Invalid target specification for file upload in mode insert: ' . $key);
      list($table, $column) = explode(':', $key);
      if (!$table || !$column) fatalerr('<p>Invalid target specification for file upload in mode insert: ' . $key);
      $tables[$table]['columns'][$column] = $value;
    }
    if (empty($tables)) fatalerr('<p>No data entered</p>');

    // Check whether there is a matching insert field for each table.column combination
    $fields = $tableinfo['options']['insert'];
    if (!empty($fields['include']) && ($fields['include'] == 'edit')) $fields += $tableinfo['options']['edit'];
    if (!empty($tableinfo['options']['insert']['keys'])) $keys = $tableinfo['options']['insert']['keys'];
    else $keys = [];

    foreach ($tables as $tabname => $insert) {
      if (empty($insert['columns'])) error_log('No columns to insert for table ' . $tabname);
      foreach ($insert['columns'] as $colname => $value) {
        $found = null;
        foreach ($fields as $id => $options) {
          if (($id == 'keys') || ($id == 'include') || ($id == 'noclear') || ($id == 'submit')) continue;
          if ($id == 'hidden') {
            foreach ($options as $hidden) {
              if (!empty($hidden['target']) && ($hidden['target'] == "$tabname.$colname")) {
                if (!isset($hidden['value'])) fatalerr("Hidden insert field has no value entry in block " . $_GET['src']);
                if ($hidden['value'] != $value) fatalerr("Illegal hidden value override in mode insertrow for table $tabname column $colname");
                $found = $options;
                break;
              }
            }
          }
          if (($id == 'onconflict') || !empty($options[$tabname])) {
            $tables[$tabname]['onconflict'] = $options[$tabname];
            continue;
          }
          if ($options === false) continue; // An insert option can be set to false to override an included edit specification
          elseif (is_string($options)) $target = $options;
          elseif (!empty($options['target'])) $target = $options['target'];
          elseif (!empty($options[0])) $target = $options[0];
          else fatalerr('Invalid insert settings for column ' . $id . ' in table ' . $_GET['src']);
          if ($target == "$tabname.$colname") {
            $found = $options;
            break;
          }
          if (is_string($options)) continue;
          elseif (!empty($options['insert'])) $newinsert = $options['insert'];
          elseif (!empty($options[2])) $newinsert = $options[2];
          else continue;
          if (!empty($newinsert['target']) && ($newinsert['target'] == "$tabname.$colname")) {
            if (!empty($newinsert['id']) && !empty($target)) $keys[$newinsert['id']] = $target;
            $found = $options;
            break;
          }
          if (!empty($newinsert[1]) && ($newinsert[1] == "$tabname.$colname")) {
            if (!empty($newinsert[0]) && !empty($target)) $keys[$newinsert[0]] = $target;
            $found = $options;
            break;
          }
        }
        if (!$found) fatalerr("No valid insert option found for table $tabname column $colname");
        if (!empty($found['phpfunction'])) {
          $func = 'return ' . str_replace('?', "'" . $value . "'", $found['phpfunction']) . ';';
          $tables[$tabname]['columns'][$colname] = eval($func);
        }
        if (!empty($found['sqlfunction'])) {
          $tables[$tabname]['sqlfunction'][$colname] = $found['sqlfunction'];
        }
        if (!empty($found['type']) && ($found['type'] == 'file')) {
          if (empty($found['path'])) fatalerr("Insert type 'file' without 'path' parameter in block " . $_GET['src']);
          $base = $found['path'];
          if (substr($base, -1) !== '/') $base .= '/';
          do {
            $path = $base . str_replace([ '+', '/' ], 'x', rtrim(base64_encode(openssl_random_pseudo_bytes(16)), '=')) . '.' . pathinfo($tables[$tabname]['columns'][$colname]['name'], PATHINFO_EXTENSION);
          } while (is_file($path));
          if (!move_uploaded_file($tables[$tabname]['columns'][$colname]['tmp_name'], $path)) fatalerr('Failed to move uploaded file into place');
          $tables[$tabname]['columns'][$colname] = $path;
        }
        elseif (!empty($found['type']) && ($found['type'] == 'image')) {
          if (empty($found['path'])) fatalerr("Insert type 'image' without 'path' parameter in block " . $_GET['src']);
          $base = $found['path'];
          if (substr($base, -1) !== '/') $base .= '/';
          do {
            $path = $base . str_replace([ '+', '/' ], 'x', rtrim(base64_encode(openssl_random_pseudo_bytes(16)), '=')) . '.' . pathinfo($tables[$tabname]['columns'][$colname]['name'], PATHINFO_EXTENSION);
          } while (is_file($path));
          if (!move_uploaded_file($tables[$tabname]['columns'][$colname]['tmp_name'], $path)) fatalerr('Failed to move uploaded image into place');
          if (!empty($found['thumb'])) {
            if ($tables[$tabname]['columns'][$colname]['type'] == 'image/jpeg') {
              $type = 'image/jpeg';
              $img = imagecreatefromjpeg($path);
            }
            elseif ($tables[$tabname]['columns'][$colname]['type'] == 'image/png') {
              $type = 'image/png';
              $img = imagecreatefrompng($path);
            }
            else fatalerr('Invalid file type ' . $tables[$tabname]['columns'][$colname]['type']);
            list($thumbtab, $thumbcol) = explode(".", $found['thumb'], 2);
            list($w, $h) = getimagesize($path);
            $dim = 100;
            $ratio = max($dim/$w, $dim/$h);
            $x = ($w - $dim / $ratio) / 2;
            $y = ($h - $dim / $ratio) / 2;
            $h = $dim / $ratio;
            $w = $h;
            $new = imagecreatetruecolor($dim, $dim);
            imagecopyresampled($new, $img, 0, 0, $x, $y, $dim, $dim, $w, $h);
            ob_start();
            imagejpeg($new, null, 75);
            $data = ob_get_clean();
            $tables[$thumbtab]['columns'][$thumbcol] = 'data:' . $type . ';base64,' . base64_encode($data);
          }
          $tables[$tabname]['columns'][$colname] = $path;
        }
      }
    }

    $dbh->query('BEGIN'); // Start a transaction so we can't have partial inserts with multiple tables

    // First insert the values that have explicit ordering requirements in the `keys` option
    if (!empty($keys)) {
      foreach ($keys as $pkey => $fkey) {
        list($ptable, $pcolumn) = explode('.', $pkey);
        list($ftable, $fcolumn) = explode('.', $fkey);
        if (!isset($tables[$ftable]['columns'])) {
          $tables[$ftable]['columns'] = [];
        }
        $id = lt_run_insert($ptable, $tables[$ptable], $pcolumn);
        lt_audit('INSERT', $ptable, $id, NULL, NULL, NULL);
        $tables[$ftable]['columns'][$fcolumn] = $id;
        unset($tables[$ptable]['columns']);
      }
    }
    // Then run the rest of the inserts
    foreach ($tables as $name => $value) {
      if (!isset($tables[$name]['columns'])) continue;
      $id = lt_run_insert($name, $tables[$name], lt_find_pk_column($name));
      lt_audit('INSERT', $name, $id, NULL, NULL, NULL);
      unset($tables[$name]['columns']); // May not be necessary
    }

    $dbh->query('COMMIT'); // Any errors will exit through fatalerr() and thus cause an implicit rollback

    $ret = doEditInsertRuns($tableinfo['options']['insert'], $id);

    if (is_string($tableinfo['query'])) {
      $ret += lt_query($tableinfo['query']);
      if (isset($ret['error'])) fatalerr('Query for table ' . $tableinfo['title'] . ' in block ' . $src[0] . ' returned error: ' . $ret['error']);
      if (empty($lt_settings['checksum']) || ($lt_settings['checksum'] == 'php')) $ret['crc'] = crc32(json_encode($ret['rows'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PARTIAL_OUTPUT_ON_ERROR));
      elseif ($lt_settings['checksum'] == 'psql') {
        $ret['crc'] = lt_query_single("SELECT md5(string_agg(q::text, '')) FROM (" . $tableinfo['query'] . ") AS q)");
        if (strpos($ret['crc'], 'Error:') === 0) fatalerr('<p>Checksum query for table ' . $tableinfo['title'] . ' returned error: ' . substr($ret['crc'], 6));
      }
    }
    else $ret['status'] = 'ok';
    break;
  case 'deleterow':
    if (empty($_POST['id']) || !is_numeric($_POST['id'])) fatalerr('Invalid delete id in mode deleterow');

    $table = lt_find_table($_GET['src']);
    if (empty($table['options']['delete']['table'])) fatalerr('No table defined in delete option in block ' . $_GET['src']);
    $target = $table['options']['delete']['table'];

    if (!empty($table['options']['delete']['runphp'])) {
      $data = lt_query($table['query'], $_POST['id']);
      eval(replaceHashes($table['options']['delete']['runphp'], $data['rows'][0]));
    }

    if (!empty($table['options']['delete']['update'])) {
      if (empty($table['options']['delete']['update']['column'])) fatalerr('No column defined in update setting for delete option in block ' . $_GET['src']);
      if (!isset($table['options']['delete']['update']['value'])) fatalerr('No value defined in update setting for delete option in block ' . $_GET['src']);
      if (!($stmt = $dbh->prepare("UPDATE " . $target . " SET " . $table['options']['delete']['update']['column'] . " = ? WHERE ' . lt_find_pk_column($target) . ' = ?"))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $table['options']['delete']['update']['value'], $_POST['id'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('UPDATE', $target, $_POST['id'], $table['options']['delete']['update']['column'], NULL, $table['options']['delete']['update']['value']);
    }
    else {
      if (!($stmt = $dbh->prepare("DELETE FROM " . $target . " WHERE " . lt_find_pk_column($target) . " = ?"))) {
        fatalerr("SQL prepare error: " . $dbh->errorInfo()[2]);
      }
      if (!($stmt->execute([ $_POST['id'] ]))) {
        fatalerr("SQL execute error: " . $stmt->errorInfo()[2]);
      }
      lt_audit('DELETE', $target, $_POST['id'], NULL, NULL, NULL);
    }
    $data = lt_query($table['query']);
    $ret = [ 'status' => 'ok', 'crc' => crc32(json_encode($data['rows'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PARTIAL_OUTPUT_ON_ERROR)) ];
    break;
  case 'donext':
    if (empty($_POST['prev'])) fatalerr('Invalid data in mode donext');
    $table = lt_find_table($_GET['src']);

    if (($_POST['prev'] === 'true') && !empty($table['options']['prev'])) {
      ob_start();
      if (is_array($table['options']['prev'])) $res = lt_print_block($table['options']['prev'][0]);
      else $res = lt_print_block($table['options']['prev']);
      if (!empty($res['location'])) $ret['location'] = $res['location'];
      else $ret['replace'] = ob_get_clean();
    }
    else {
      if (!empty($table['options']['fields'])) {
        foreach ($table['options']['fields'] as $field) {
          if (!empty($_POST['field_'.$field[0]])) {
            lt_setvar('field_'.$field[0], $_POST['field_'.$field[0]], true);
          }
        }
      }
      if (!empty($table['options']['verify'])) {
        if (is_array($table['options']['verify'])) {
          foreach ($table['options']['verify'] as $check) {
            if (!is_array($check) || (count($check) != 2)) fatalerr('Invalid verify option in lt_control ' . $_GET['src']);
            if (!lt_query_check($check[0])) {
              $ret['error'] = $check[1];
              break;
            }
          }
          if (!empty($ret['error'])) break;
        }
        else {
          if (!lt_query_check($table['options']['verify'])) {
            if (!empty($table['options']['error'])) $ret['error'] = $table['options']['error'];
            else $ret['error'] = 'Step not complete';
            break;
          }
        }
      }
      if (!empty($table['options']['setvar'])) {
        foreach ($table['options']['setvar'] as $name => $value) {
          lt_setvar($name, $value);
        }
      }
      if (!empty($table['options']['runphp'])) {
        global $mch;
        $res = eval($table['options']['runphp']);
        if ($res === FALSE) fatalerr('Syntax error in lt_control ' . $_GET['src'] . ' php option');
        elseif (is_string($res)) {
          $ret['error'] = $res;
          break;
        }
      }
      if (!empty($table['options']['next'])) {
        ob_start();
        if (is_array($table['options']['next'])) $res = lt_print_block($table['options']['next'][0]);
        else $res = lt_print_block($table['options']['next']);
        if (!empty($res['location'])) {
          ob_clean(); // Clear the block DIV already output by lt_print_block()
          $ret['location'] = $res['location'];
        }
        else $ret['replace'] = ob_get_clean();
      }
    }
    break;
  default:
    fatalerr('Invalid mode specified');
}

header('Content-type: application/json; charset=utf-8');
if (is_string($ret)) print $ret;
else print json_encode($ret, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PARTIAL_OUTPUT_ON_ERROR);
