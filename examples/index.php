<?php

require('libtables.php');

if (!empty($_GET['view'])) $view = $_GET['view'];
elseif (!empty($_POST['view'])) $view = $_POST['view'];
else $view = 'none';

?>
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Libtables example</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css" integrity="sha512-nMNlpuaDPrqlEls3IX/Q56H36qvBASwb3ipuo3MxeWbsQB1881ox0cRv7UPTgBlriqoynt35KjEwgGUeUXIPnw==" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="stylesheet" href="libtables.css">
<?php if (file_exists('local.css')) print '  <link rel="stylesheet" href="local.css">'; ?>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js" integrity="sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js" integrity="sha512-2ImtlRlf2VVmiGZsjm9bEyhjGW4dU7B6TNwh/hx/iSByxNENtj3WVE6o/9Lj4TJeVXPi4bnOIMXFIJJAeufa0A==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script src="libtables.js"></script>
<?php if (file_exists('local.js')) print '  <script src="local.js"></script>'; ?>
</head>

<body>
<?php

if (lt_block_exists('header')) lt_print_block('header');
if (lt_block_exists('menu')) lt_print_block('menu');

print '<main>';
if (lt_block_exists($view)) lt_print_block($view);
else switch ($view) {
  case 'example-view-with-get-parameter':
    if (!empty($_GET['variable'])) {
      lt_setvar('variable', $_GET['variable']);
      lt_print_block('block-with-variable');
      break;
    }
    // Intentional fallthrough
  default:
    if (lt_block_exists('notfound')) lt_print_block('notfound');
    else print "Page not found";
}
print '</main>';

if (lt_block_exists('footer')) lt_print_block('footer');

?>
<div id="overlay"><div id="overlay_content"></div></div>
</body>
</html>
<?php
