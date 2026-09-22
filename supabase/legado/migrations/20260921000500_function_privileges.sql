-- A função de numeração é interna às RPCs de escrita.
revoke all on function app.next_ppp_protocol() from public;
revoke all on function app.next_ppp_protocol() from authenticated;
