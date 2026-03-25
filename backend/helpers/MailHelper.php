<?php
// helpers/MailHelper.php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

class MailHelper
{
  /**
   * Lee mail.ini y devuelve la configuración.
   */
  private static function config(): array
  {
    $path = __DIR__ . '/../config/init/mail.ini';
    if (!file_exists($path)) {
      throw new \RuntimeException('Archivo mail.ini no encontrado en: ' . $path);
    }
    $cfg = parse_ini_file($path);
    if ($cfg === false) {
      throw new \RuntimeException('No se pudo leer mail.ini');
    }
    return $cfg;
  }

  /**
   * Envía la factura en PDF al correo del cliente.
   *
   * @param string $toEmail    Correo del destinatario
   * @param string $toName     Nombre del cliente
   * @param string $facturaNum Número de factura
   * @param string $pdfBase64  PDF codificado en base64
   *
   * @throws \PHPMailer\PHPMailer\Exception Si el correo no puede enviarse
   */
  public static function sendFactura(
    string $toEmail,
    string $toName,
    string $facturaNum,
    string $pdfBase64
  ): void {
    $cfg = self::config();

    $mail = new PHPMailer(true);

    // ── SMTP ──────────────────────────────────────────────────────────
    $mail->isSMTP();
    $mail->Host       = $cfg['MAIL_HOST']     ?? '';
    $mail->SMTPAuth   = true;
    $mail->Username   = $cfg['MAIL_USERNAME'] ?? '';
    $mail->Password   = $cfg['MAIL_PASSWORD'] ?? '';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // SSL en puerto 465
    $mail->Port       = (int) ($cfg['MAIL_PORT'] ?? 465);
    $mail->CharSet    = 'UTF-8';

    // ── Remitente / destinatario ──────────────────────────────────────
    $fromEmail = $cfg['MAIL_FROM']      ?? ($cfg['MAIL_USERNAME'] ?? '');
    $fromName  = $cfg['MAIL_FROM_NAME'] ?? 'Facturación';

    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($toEmail, $toName);

    // ── Asunto y cuerpo ───────────────────────────────────────────────
    $mail->Subject = 'Factura ' . $facturaNum . ' — ' . $fromName;
    $mail->isHTML(true);
    $mail->Body    = self::htmlBody($toName, $facturaNum, $fromName);
    $mail->AltBody = 'Estimado/a ' . $toName . ', adjunto encontrará su factura ' . $facturaNum . '.';

    // ── Adjunto PDF ───────────────────────────────────────────────────
    $pdfBytes = base64_decode($pdfBase64, true);
    if ($pdfBytes === false) {
      throw new \InvalidArgumentException('El contenido base64 del PDF no es válido');
    }

    $mail->addStringAttachment(
      $pdfBytes,
      'Factura-' . $facturaNum . '.pdf',
      PHPMailer::ENCODING_BASE64,
      'application/pdf'
    );

    $mail->send();
  }

  /**
   * Genera el cuerpo HTML del correo.
   */
  private static function htmlBody(string $nombre, string $factura, string $empresa): string
  {
    $n    = htmlspecialchars($nombre,  ENT_QUOTES, 'UTF-8');
    $f    = htmlspecialchars($factura, ENT_QUOTES, 'UTF-8');
    $e    = htmlspecialchars($empresa, ENT_QUOTES, 'UTF-8');
    $year = date('Y');

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:10px;overflow:hidden;
                      box-shadow:0 4px 16px rgba(0,0,0,.10);">

          <!-- ── Cabecera ──────────────────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a56db 0%,#1e40af 100%);
                        padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin:0 0 2px;font-size:11px;color:#bfdbfe;
                               letter-spacing:1.5px;text-transform:uppercase;">
                      Sistema de Gestión Comercial
                    </p>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">
                      $e
                    </h1>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;background:rgba(255,255,255,.15);
                                  border-radius:6px;padding:6px 14px;
                                  color:#ffffff;font-size:13px;font-weight:bold;
                                  letter-spacing:.5px;">
                      FACTURA
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Banda de número de factura ───────────────────────── -->
          <tr>
            <td style="background:#eff6ff;padding:12px 36px;
                        border-bottom:1px solid #dbeafe;">
              <p style="margin:0;font-size:13px;color:#1e40af;">
                <strong>N° de Comprobante:</strong>&nbsp;
                <span style="font-size:15px;font-weight:bold;color:#1a56db;">$f</span>
              </p>
            </td>
          </tr>

          <!-- ── Cuerpo principal ──────────────────────────────────── -->
          <tr>
            <td style="padding:36px;">

              <p style="margin:0 0 18px;font-size:16px;color:#111827;">
                Estimado/a <strong>$n</strong>,
              </p>

              <p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.7;">
                Nos complace informarle que su comprobante de compra ha sido procesado
                exitosamente. Adjunto encontrará su factura
                <strong style="color:#1a56db;">No.&nbsp;$f</strong> en formato
                <strong>PDF</strong> lista para descargar o imprimir.
              </p>

              <!-- ── Recuadro informativo ── -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:20px 0;background:#f8fafc;border-radius:8px;
                            border-left:4px solid #1a56db;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1e40af;">
                      &#9432;&nbsp; Información importante
                    </p>
                    <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.6;">
                      Conserve este comprobante como respaldo de su transacción.
                      Si detecta algún error en los datos de su factura, comuníquese
                      con nosotros a la brevedad posible.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
                Agradecemos su preferencia y confianza. Queda a su disposición para cualquier
                consulta o aclaración.
              </p>

              <!-- ── Separador ── -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">

              <!-- ── Nota pie del cuerpo ── -->
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                &#128274;&nbsp; Este es un correo automático generado por el
                <strong>Sistema de Gestión Comercial</strong>.
                Por favor no responda directamente a este mensaje.
              </p>

            </td>
          </tr>

          <!-- ── Pie de página ─────────────────────────────────────── -->
          <tr>
            <td style="background:#1e293b;padding:20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
                      <strong style="color:#e2e8f0;">$e</strong>
                    </p>
                    <p style="margin:0;font-size:11px;color:#64748b;">
                      Sistema de Gestión Comercial
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <p style="margin:0;font-size:11px;color:#64748b;text-align:right;">
                      &copy; $year SolucionesITEC<br>
                      Todos los derechos reservados
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
  }
}
