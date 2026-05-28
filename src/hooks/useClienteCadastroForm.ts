import { useCallback, useState, type ChangeEvent } from 'react'
import { buscarEnderecoPorCepBr } from '../lib/cepAutofillBr'
import {
  equipamentoContratoInicial,
  normalizarListasContratoForm,
  residuoContratoInicial,
  veiculoContratoInicial,
  type EquipamentoContratoItem,
  type VeiculoContratoItem,
} from '../lib/clienteContratoCadastro'
import {
  derivarDadosUnidadeDocumento,
  formClienteInicial,
  formatarCNPJ,
  type FormCliente,
  type ResiduoForm,
} from '../lib/clienteCadastroForm'

export function useClienteCadastroForm(initial?: Partial<FormCliente>) {
  const [form, setForm] = useState<FormCliente>(() =>
    normalizarListasContratoForm({ ...formClienteInicial, ...initial })
  )

  const resetForm = useCallback(() => {
    setForm(formClienteInicial)
  }, [])

  const loadForm = useCallback((dados: Partial<FormCliente>) => {
    setForm(normalizarListasContratoForm({ ...formClienteInicial, ...dados }))
  }, [])

  function handleInputChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    const rawValue = name === 'cnpj' ? formatarCNPJ(value) : value
    if (name === 'representante_rg_id') {
      setForm((prev) => ({ ...prev, representante_rg_id: rawValue }))
      return
    }
    setForm((prev) => ({
      ...prev,
      [name]: rawValue,
      ...(name === 'cnpj' ? derivarDadosUnidadeDocumento(rawValue) : {}),
    }))
  }

  async function preencherEnderecoPorCep(cep: string, alvo: 'coleta' | 'faturamento') {
    const end = await buscarEnderecoPorCepBr(cep)
    if (!end) return
    setForm((prev) => {
      if (alvo === 'coleta') {
        return {
          ...prev,
          rua: end.logradouro || prev.rua,
          bairro: end.bairro || prev.bairro,
          cidade: end.localidade || prev.cidade,
          estado: end.uf || prev.estado,
        }
      }
      return {
        ...prev,
        rua_faturamento: end.logradouro || prev.rua_faturamento,
        bairro_faturamento: end.bairro || prev.bairro_faturamento,
        cidade_faturamento: end.localidade || prev.cidade_faturamento,
        estado_faturamento: end.uf || prev.estado_faturamento,
      }
    })
  }

  function handleResiduoChange(index: number, campo: keyof ResiduoForm, valor: string) {
    setForm((prev) => {
      const residuosAtualizados = [...prev.residuos]
      residuosAtualizados[index] = { ...residuosAtualizados[index], [campo]: valor }
      return { ...prev, residuos: residuosAtualizados }
    })
  }

  function adicionarResiduo() {
    setForm((prev) => ({
      ...prev,
      residuos: [...prev.residuos, { ...residuoContratoInicial() }],
    }))
  }

  function removerResiduo(index: number) {
    setForm((prev) => {
      if (prev.residuos.length === 1) return { ...prev, residuos: [{ ...residuoContratoInicial() }] }
      return { ...prev, residuos: prev.residuos.filter((_, i) => i !== index) }
    })
  }

  function handleVeiculoContratoChange(
    index: number,
    campo: keyof VeiculoContratoItem,
    valor: string | boolean
  ) {
    setForm((prev) => {
      const lista = [...prev.veiculos_contrato]
      const atual = { ...lista[index], [campo]: valor }
      if (campo === 'sem_custo' && valor === true) atual.valor = ''
      if (campo === 'valor' && typeof valor === 'string' && valor.trim()) {
        atual.sem_custo = false
      }
      lista[index] = atual
      return { ...prev, veiculos_contrato: lista }
    })
  }

  function adicionarVeiculoContrato() {
    setForm((prev) => ({
      ...prev,
      veiculos_contrato: [...prev.veiculos_contrato, veiculoContratoInicial()],
    }))
  }

  function removerVeiculoContrato(index: number) {
    setForm((prev) => {
      if (prev.veiculos_contrato.length === 1) {
        return { ...prev, veiculos_contrato: [veiculoContratoInicial()] }
      }
      return { ...prev, veiculos_contrato: prev.veiculos_contrato.filter((_, i) => i !== index) }
    })
  }

  function handleEquipamentoContratoChange(
    index: number,
    campo: keyof EquipamentoContratoItem,
    valor: string | boolean
  ) {
    setForm((prev) => {
      const lista = [...prev.equipamentos_contrato]
      const atual = { ...lista[index], [campo]: valor }
      if (campo === 'com_custo' && valor === false) atual.valor = ''
      if (campo === 'valor' && typeof valor === 'string' && valor.trim()) {
        atual.com_custo = true
      }
      lista[index] = atual
      return { ...prev, equipamentos_contrato: lista }
    })
  }

  function adicionarEquipamentoContrato() {
    setForm((prev) => ({
      ...prev,
      equipamentos_contrato: [...prev.equipamentos_contrato, equipamentoContratoInicial()],
    }))
  }

  function removerEquipamentoContrato(index: number) {
    setForm((prev) => {
      if (prev.equipamentos_contrato.length === 1) {
        return { ...prev, equipamentos_contrato: [equipamentoContratoInicial()] }
      }
      return {
        ...prev,
        equipamentos_contrato: prev.equipamentos_contrato.filter((_, i) => i !== index),
      }
    })
  }

  return {
    form,
    setForm,
    resetForm,
    loadForm,
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
  }
}
