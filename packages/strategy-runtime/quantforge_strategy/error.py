"""量化平台基础错误"""


class QuantError(Exception):
    def __init__(self, code: str, message: str, detail: object = None) -> None:
        super().__init__(message)
        self.name = "QuantError"
        self.code = code
        self.detail = detail
