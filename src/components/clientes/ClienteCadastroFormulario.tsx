import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { ClienteContratoCadastroSecoes } from "./ClienteContratoCadastroSecoes"
import {
  alternarMtrSigorOpcao,
  clienteFieldLabelHelpStyle,
  clienteFieldLabelStackStyle,
  clienteFieldLabelTextStyle,
  clienteGridCols,
  clienteInputStyle,
  clienteLabelSigorCheckboxStyle,
} from "../../lib/clienteCadastroUi"
import type { FormCliente } from "../../lib/clienteCadastroForm"
import { ClienteGeradorDonoFaturamentoCampos } from "./ClienteGeradorDonoFaturamentoCampos"
import type { useClienteCadastroForm } from "../../hooks/useClienteCadastroForm"

type RepresentanteOpt = { id: string; nome: string }

type CadastroHandlers = ReturnType<typeof useClienteCadastroForm>

export type ClienteCadastroFormularioProps = CadastroHandlers & {
  representantesRg: RepresentanteOpt[]
  submitLabel?: string
  salvando?: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onCancelar?: () => void
  /** Conteúdo após Salvar/Cancelar (ex.: MTRs baixadas no Gerenciador). */
  depoisDosBotoes?: ReactNode
  /** Preenche colunas conforme a largura do painel (página Gerenciador). */
  gridFluido?: boolean
  form: FormCliente
  setForm: Dispatch<SetStateAction<FormCliente>>
}

export function ClienteCadastroFormulario({
  form,
  setForm,
  representantesRg,
  submitLabel = "Salvar",
  salvando = false,
  onSubmit,
  onCancelar,
  depoisDosBotoes,
  gridFluido = false,
  handleInputChange,
  preencherEnderecoPorCep,
  handleResiduoChange,
  adicionarResiduo,
  removerResiduo,
  handleVeiculoContratoChange,
  adicionarVeiculoContrato,
  removerVeiculoContrato,
  handleEquipamentoContratoChange,
  adicionarEquipamentoContrato,
  removerEquipamentoContrato,
  handleMaoObraContratoChange,
  adicionarMaoObraContrato,
  removerMaoObraContrato,
}: ClienteCadastroFormularioProps) {
  const inputStyle = clienteInputStyle
  const grid4 = clienteGridCols('4', gridFluido)
  const grid3 = clienteGridCols('3', gridFluido)
  const grid6 = clienteGridCols('6', gridFluido)
  const gridResp = clienteGridCols('2-1', gridFluido)

  return (
    <form
      onSubmit={onSubmit}
              style={{
                padding: '22px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Dados básicos
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                  Preencha pelo menos um destes três para identificar o cliente: <strong>Nome fantasia</strong>,{' '}
                  <strong>Razão social</strong> ou <strong>CNPJ/CPF</strong>. Os restantes campos do cadastro são
                  opcionais e podem ser completados depois.
                </p>

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid4,
                    gap: "12px",
                  }}
                >
                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>Nome fantasia</span>
                    <input
                      name="nome"
                      value={form.nome}
                      onChange={handleInputChange}
                      placeholder="Nome fantasia"
                      style={inputStyle}
                    />
                  </label>

                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>Razão social</span>
                    <input
                      name="razao_social"
                      value={form.razao_social}
                      onChange={handleInputChange}
                      placeholder="Razão social"
                      style={inputStyle}
                    />
                  </label>

                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>CNPJ / CPF</span>
                    <input
                      name="cnpj"
                      value={form.cnpj}
                      onChange={handleInputChange}
                      placeholder="CNPJ/CPF"
                      style={inputStyle}
                    />
                  </label>

                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>Status</span>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleInputChange}
                      style={inputStyle}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </label>
                </div>
                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid4,
                    gap: "12px",
                    marginTop: "12px",
                  }}
                >
                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>Cliente desde</span>
                    <input
                      type="date"
                      name="status_ativo_desde"
                      value={form.status_ativo_desde}
                      onChange={handleInputChange}
                      title="Data em que o cliente passou a ser cliente (opcional)"
                      style={inputStyle}
                    />
                    <span style={clienteFieldLabelHelpStyle}>
                      Data em que o cliente passou a ser cliente.
                    </span>
                  </label>

                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>
                      Cliente inativo desde
                    </span>
                    <input
                      type="date"
                      name="status_inativo_desde"
                      value={form.status_inativo_desde}
                      onChange={handleInputChange}
                      title="Data em que o cliente foi marcado como inativo (opcional)"
                      style={inputStyle}
                    />
                    <span style={clienteFieldLabelHelpStyle}>
                      Data em que o cliente foi marcado como inativo.
                    </span>
                  </label>

                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>Tipo de unidade</span>
                    <input
                      name="tipo_unidade_cliente"
                      value={form.tipo_unidade_cliente}
                      readOnly
                      placeholder="Matriz / Filial / Pessoa física"
                      title="Calculado automaticamente pelo CNPJ/CPF"
                      style={{ ...inputStyle, background: "#f8fafc" }}
                    />
                    <span style={clienteFieldLabelHelpStyle}>
                      Calculado a partir do CNPJ/CPF.
                    </span>
                  </label>

                  <label style={clienteFieldLabelStackStyle}>
                    <span style={clienteFieldLabelTextStyle}>Raiz do CNPJ</span>
                    <input
                      name="cnpj_raiz"
                      value={form.cnpj_raiz}
                      readOnly
                      placeholder="Raiz do CNPJ"
                      title="Raiz usada para agrupar matriz e filiais"
                      style={{ ...inputStyle, background: "#f8fafc" }}
                    />
                    <span style={clienteFieldLabelHelpStyle}>
                      Agrupa matriz e filiais do mesmo grupo.
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#334155",
                    marginBottom: "12px",
                  }}
                >
                  Colunas da aba CLIENTES
                </div>

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid3,
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <input
                    name="licenca_numero"
                    value={form.licenca_numero}
                    onChange={handleInputChange}
                    placeholder="CADRI"
                    title="Coluna CADRI da planilha"
                    style={inputStyle}
                  />
                  <input
                    type="date"
                    name="validade"
                    value={form.validade}
                    onChange={handleInputChange}
                    placeholder="Venc CADRI"
                    title="Coluna Venc CADRI da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="codigo_ibama"
                    value={form.codigo_ibama}
                    onChange={handleInputChange}
                    placeholder="Código IBAMA"
                    title="Coluna Código IBAMA da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="descricao_veiculo"
                    value={form.descricao_veiculo}
                    onChange={handleInputChange}
                    placeholder="Descrição veículo"
                    title="Coluna Descrição veículo da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="ajudante"
                    value={form.ajudante}
                    onChange={handleInputChange}
                    placeholder="Ajudante"
                    title="Coluna Ajudante da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="mtr_coleta"
                    value={form.mtr_coleta}
                    onChange={handleInputChange}
                    placeholder="MTR de Coleta"
                    title="Coluna MTR de Coleta da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="destino"
                    value={form.destino}
                    onChange={handleInputChange}
                    placeholder="Destino"
                    title="Coluna Destino da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="mtr_destino"
                    value={form.mtr_destino}
                    onChange={handleInputChange}
                    placeholder="MTR de Destino"
                    title="Coluna MTR de Destino da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="residuo_destino"
                    value={form.residuo_destino}
                    onChange={handleInputChange}
                    placeholder="Resíduo de Destino"
                    title="Coluna Resíduo de Destino da planilha"
                    style={inputStyle}
                  />
                  <input
                    name="solicitante"
                    value={form.solicitante}
                    onChange={handleInputChange}
                    placeholder="Solicitante"
                    style={inputStyle}
                  />
                  <input
                    name="origem_planilha_cliente"
                    value={form.origem_planilha_cliente}
                    onChange={handleInputChange}
                    placeholder="Origem da planilha"
                    style={inputStyle}
                  />
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                    }}
                    title="SIGOR: Cliente, RG ou Não tem"
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        color: "#334155",
                      }}
                    >
                      SIGOR:
                    </span>
                    <label style={clienteLabelSigorCheckboxStyle}>
                      <input
                        type="checkbox"
                        checked={form.mtr_sigor === "cliente"}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            mtr_sigor: alternarMtrSigorOpcao(prev.mtr_sigor, "cliente"),
                          }))
                        }
                      />
                      Cliente
                    </label>
                    <label style={clienteLabelSigorCheckboxStyle}>
                      <input
                        type="checkbox"
                        checked={form.mtr_sigor === "rg"}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            mtr_sigor: alternarMtrSigorOpcao(prev.mtr_sigor, "rg"),
                          }))
                        }
                      />
                      RG
                    </label>
                    <label style={clienteLabelSigorCheckboxStyle}>
                      <input
                        type="checkbox"
                        checked={form.mtr_sigor === "nao_tem"}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            mtr_sigor: alternarMtrSigorOpcao(prev.mtr_sigor, "nao_tem"),
                          }))
                        }
                      />
                      Não tem
                    </label>
                  </div>
                </div>

                <textarea
                  name="observacoes_operacionais"
                  value={form.observacoes_operacionais}
                  onChange={handleInputChange}
                  placeholder="Observações operacionais"
                  title="Coluna Observações da planilha"
                  rows={3}
                  style={{ ...inputStyle, height: "auto", paddingTop: "10px", resize: "vertical" }}
                />
                <textarea
                  name="observacoes_gerais"
                  value={form.observacoes_gerais}
                  onChange={handleInputChange}
                  placeholder="Observações gerais (cadastro)"
                  title="Observações gerais sobre o cliente"
                  rows={3}
                  style={{
                    ...inputStyle,
                    height: "auto",
                    paddingTop: "10px",
                    resize: "vertical",
                    marginTop: "10px",
                  }}
                />
                <input
                  name="link_google_maps"
                  type="url"
                  inputMode="url"
                  value={form.link_google_maps}
                  onChange={handleInputChange}
                  placeholder="https://maps.google.com/... (link do Google Maps / GPS)"
                  title="Cole o link completo do Google Maps (deve começar com http:// ou https://)"
                  style={{ ...inputStyle, marginTop: "10px" }}
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#334155",
                    marginBottom: "12px",
                  }}
                >
                  Endereço de Coleta
                </div>

                <textarea
                  name="endereco_coleta"
                  value={form.endereco_coleta}
                  onChange={handleInputChange}
                  placeholder="Endereço completo (coluna ENDEREÇO da planilha)"
                  title="Texto original da coluna ENDEREÇO. Os campos estruturados abaixo podem ser preenchidos quando houver separação por CEP/rua/número."
                  rows={2}
                  style={{
                    ...inputStyle,
                    height: "auto",
                    paddingTop: "10px",
                    resize: "vertical",
                    marginBottom: "12px",
                  }}
                />

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid6,
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <input
                    name="cep"
                    value={form.cep}
                    onChange={handleInputChange}
                    onBlur={() => void preencherEnderecoPorCep(form.cep, "coleta")}
                    placeholder="CEP"
                    style={inputStyle}
                  />
                  <input
                    name="rua"
                    value={form.rua}
                    onChange={handleInputChange}
                    placeholder="Rua"
                    style={inputStyle}
                  />
                  <input
                    name="numero"
                    value={form.numero}
                    onChange={handleInputChange}
                    placeholder="Número"
                    style={inputStyle}
                  />
                  <input
                    name="complemento"
                    value={form.complemento}
                    onChange={handleInputChange}
                    placeholder="Complemento"
                    style={inputStyle}
                  />
                  <input
                    name="bairro"
                    value={form.bairro}
                    onChange={handleInputChange}
                    placeholder="Bairro"
                    style={inputStyle}
                  />
                  <input
                    name="cidade"
                    value={form.cidade}
                    onChange={handleInputChange}
                    placeholder="Cidade"
                    style={inputStyle}
                  />
                </div>

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid6,
                    gap: "12px",
                  }}
                >
                  <input
                    name="estado"
                    value={form.estado}
                    onChange={handleInputChange}
                    placeholder="Estado"
                    style={{ ...inputStyle, maxWidth: "240px" }}
                  />
                </div>
              </div>

              <div>
                <ClienteGeradorDonoFaturamentoCampos
                  form={form}
                  setForm={setForm}
                  inputStyle={inputStyle}
                />

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid6,
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <input
                    name="cep_faturamento"
                    value={form.cep_faturamento}
                    onChange={handleInputChange}
                    onBlur={() => void preencherEnderecoPorCep(form.cep_faturamento, "faturamento")}
                    placeholder="CEP"
                    style={inputStyle}
                  />
                  <input
                    name="rua_faturamento"
                    value={form.rua_faturamento}
                    onChange={handleInputChange}
                    placeholder="Rua"
                    style={inputStyle}
                  />
                  <input
                    name="numero_faturamento"
                    value={form.numero_faturamento}
                    onChange={handleInputChange}
                    placeholder="Número"
                    style={inputStyle}
                  />
                  <input
                    name="complemento_faturamento"
                    value={form.complemento_faturamento}
                    onChange={handleInputChange}
                    placeholder="Complemento"
                    style={inputStyle}
                  />
                  <input
                    name="bairro_faturamento"
                    value={form.bairro_faturamento}
                    onChange={handleInputChange}
                    placeholder="Bairro"
                    style={inputStyle}
                  />
                  <input
                    name="cidade_faturamento"
                    value={form.cidade_faturamento}
                    onChange={handleInputChange}
                    placeholder="Cidade"
                    style={inputStyle}
                  />
                </div>

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid6,
                    gap: "12px",
                  }}
                >
                  <input
                    name="estado_faturamento"
                    value={form.estado_faturamento}
                    onChange={handleInputChange}
                    placeholder="Estado"
                    style={{ ...inputStyle, maxWidth: "240px" }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#334155",
                    marginBottom: "12px",
                  }}
                >
                  Responsável
                </div>

                <div
                  className="rg-mobile-stack-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridResp,
                    gap: "12px",
                  }}
                >
                  <input
                    name="responsavel_nome"
                    value={form.responsavel_nome}
                    onChange={handleInputChange}
                    placeholder="Representante do Faturamento"
                    aria-label="Representante do Faturamento"
                    style={inputStyle}
                  />

                  <input
                    name="telefone"
                    value={form.telefone}
                    onChange={handleInputChange}
                    placeholder="Telefone"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginTop: "12px" }}>
                  <input
                    name="email_nf"
                    value={form.email_nf}
                    onChange={handleInputChange}
                    placeholder="E-mail(s) para envio de NF — separar vários com ;"
                    style={inputStyle}
                  />
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.45 }}>
                    Um ou mais endereços, separados por ponto e vírgula (ex.: financeiro@empresa.com;
                    contato@empresa.com).
                  </p>
                </div>

                <div style={{ marginTop: "10px" }}>
                  <input
                    name="margem_lucro_percentual"
                    value={form.margem_lucro_percentual}
                    onChange={handleInputChange}
                    placeholder="Margem de lucro (%) — ex.: 12,5"
                    style={inputStyle}
                    inputMode="decimal"
                    aria-label="Margem de lucro percentual do cliente"
                  />
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.45 }}>
                    Opcional. Usada no faturamento; deixe em branco se não aplicável.
                  </p>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#334155",
                    marginBottom: "12px",
                  }}
                >
                  Representante RG
                </div>

                <select
                  id="cliente-representante-rg"
                  name="representante_rg_id"
                  value={form.representante_rg_id}
                  onChange={handleInputChange}
                  aria-label="Representante RG"
                  style={inputStyle}
                >
                  <option value="">Selecione o representante RG</option>
                  {representantesRg.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>

                <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.45 }}>
                  Cadastro em <strong>Cadastros → Representantes RG</strong>. Independente do{' '}
                  <strong>Representante do Faturamento</strong> acima (contato / NF).
                </p>

                <ClienteContratoCadastroSecoes
                  inputStyle={inputStyle}
                  veiculos={form.veiculos_contrato}
                  equipamentos={form.equipamentos_contrato}
                  maoObra={form.mao_obra_contrato}
                  residuos={form.residuos}
                  onVeiculoChange={handleVeiculoContratoChange}
                  onAdicionarVeiculo={adicionarVeiculoContrato}
                  onRemoverVeiculo={removerVeiculoContrato}
                  onEquipamentoChange={handleEquipamentoContratoChange}
                  onAdicionarEquipamento={adicionarEquipamentoContrato}
                  onRemoverEquipamento={removerEquipamentoContrato}
                  onMaoObraChange={handleMaoObraContratoChange}
                  onAdicionarMaoObra={adicionarMaoObraContrato}
                  onRemoverMaoObra={removerMaoObraContrato}
                  onResiduoChange={handleResiduoChange}
                  onAdicionarResiduo={adicionarResiduo}
                  onRemoverResiduo={removerResiduo}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  marginTop: '16px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start',
                }}
              >
                <button
                  type="submit"
                  disabled={salvando}
                  style={{
                    background: "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    height: "42px",
                    padding: "0 18px",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: salvando ? 0.8 : 1,
                  }}
                >
                  {salvando ? 'Salvando…' : submitLabel}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCancelar?.();
                  }}
                  style={{
                    background: "#e5e7eb",
                    color: "#111827",
                    border: "none",
                    borderRadius: "10px",
                    height: "42px",
                    padding: "0 18px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>

              {depoisDosBotoes ? (
                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  {depoisDosBotoes}
                </div>
              ) : null}
    </form>
  )
}
